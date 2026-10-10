import type { JsonValue } from '../../../media/contracts.js';
import { EngineError } from '../../../shared/errors.js';
import { outputFormat, saveElevenLabsAudioStream } from '../audio-output.js';
import { requestElevenLabsAudio } from '../client.js';
import type { ElevenLabsOperation } from './registry.js';

const MAX_DISTINCT_VOICES = 10;
const MAX_SEED = 4_294_967_295;
const DIALOGUE_FIELDS = new Set(['inputs', 'settings', 'output_format', 'language_code', 'seed']);
const DIALOGUE_LINE_FIELDS = new Set(['text', 'voice']);
const DIALOGUE_SETTINGS_FIELDS = new Set(['stability', 'similarity']);

interface DialogueInputIssue {
  instancePath: string;
  keyword: string;
  message: string;
}

interface DialogueLine {
  text: string;
  voice: string;
}

interface DialogueSettings {
  stability?: number;
  similarity?: number;
}

export const elevenLabsDialogueOperation: ElevenLabsOperation = {
  validate(input, target) {
    const issues = [
      ...unknownFieldIssues(input, DIALOGUE_FIELDS, ''),
      ...dialogueLineIssues(input.inputs),
      ...settingsIssues(input.settings),
      ...optionalStringIssue(input.output_format, '/output_format'),
      ...optionalStringIssue(input.language_code, '/language_code'),
      ...seedIssues(input.seed),
    ];
    if (issues.length > 0) {
      throw new EngineError(
        'ENGINE_REQUEST_INVALID',
        `ElevenLabs dialogue request for ${target.model} is invalid.`,
        { provider: 'elevenlabs', model: target.model, details: issues.map((issue) => ({ ...issue })) },
      );
    }
  },
  async execute(input, target, context) {
    const lines = input.inputs as unknown as DialogueLine[];
    const stream = await requestElevenLabsAudio({
      model: target.model,
      context,
      send: (client) => client.textToDialogue.convert({
        inputs: lines.map(({ text, voice }) => ({ text, voiceId: voice })),
        modelId: target.modelId,
        settings: dialogueSettings(input.settings),
        outputFormat: outputFormat(input),
        languageCode: typeof input.language_code === 'string' ? input.language_code : undefined,
        seed: typeof input.seed === 'number' ? input.seed : undefined,
      }, { abortSignal: context.signal }),
    });
    return saveElevenLabsAudioStream({ stream, nativeInput: input, model: target.model, context });
  },
};

function dialogueSettings(value: JsonValue | undefined): DialogueSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    ...(typeof value.stability === 'number' ? { stability: value.stability } : {}),
    ...(typeof value.similarity === 'number' ? { similarity: value.similarity } : {}),
  };
}

function dialogueLineIssues(value: JsonValue | undefined): DialogueInputIssue[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{
      instancePath: '/inputs',
      keyword: 'minItems',
      message: 'ElevenLabs dialogue "inputs" must be a non-empty array.',
    }];
  }
  const issues = value.flatMap((line, index) => lineIssues(line, `/inputs/${index}`));
  const voices = new Set(value.flatMap((line) => (
    isRecord(line) && typeof line.voice === 'string' ? [line.voice] : []
  )));
  if (voices.size > MAX_DISTINCT_VOICES) {
    issues.push({
      instancePath: '/inputs',
      keyword: 'maxDistinctVoices',
      message: `ElevenLabs dialogue allows at most ${MAX_DISTINCT_VOICES} distinct voices; received ${voices.size}.`,
    });
  }
  return issues;
}

function lineIssues(line: JsonValue, path: string): DialogueInputIssue[] {
  if (!isRecord(line)) {
    return [{ instancePath: path, keyword: 'type', message: 'Dialogue input must be an object.' }];
  }
  return [
    ...unknownFieldIssues(line, DIALOGUE_LINE_FIELDS, path),
    ...requiredStringIssue(line.text, `${path}/text`),
    ...requiredStringIssue(line.voice, `${path}/voice`),
  ];
}

function settingsIssues(value: JsonValue | undefined): DialogueInputIssue[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return [{ instancePath: '/settings', keyword: 'type', message: 'Dialogue "settings" must be an object.' }];
  }
  return [
    ...unknownFieldIssues(value, DIALOGUE_SETTINGS_FIELDS, '/settings'),
    ...optionalNumberIssue(value.stability, '/settings/stability'),
    ...optionalNumberIssue(value.similarity, '/settings/similarity'),
  ];
}

function seedIssues(value: JsonValue | undefined): DialogueInputIssue[] {
  if (value === undefined || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SEED)) {
    return [];
  }
  return [{
    instancePath: '/seed',
    keyword: 'type',
    message: `Dialogue "seed" must be an integer between 0 and ${MAX_SEED}.`,
  }];
}

function unknownFieldIssues(
  value: Record<string, JsonValue>,
  allowed: ReadonlySet<string>,
  path: string,
): DialogueInputIssue[] {
  return Object.keys(value)
    .filter((field) => !allowed.has(field))
    .map((field) => ({
      instancePath: `${path}/${field}`,
      keyword: 'additionalProperties',
      message: `Dialogue field "${field}" is not supported.`,
    }));
}

function requiredStringIssue(value: JsonValue | undefined, path: string): DialogueInputIssue[] {
  if (typeof value === 'string' && value.trim().length > 0) {
    return [];
  }
  return [{ instancePath: path, keyword: 'required', message: `Dialogue "${path}" must be a non-empty string.` }];
}

function optionalStringIssue(value: JsonValue | undefined, path: string): DialogueInputIssue[] {
  if (value === undefined || (typeof value === 'string' && value.trim().length > 0)) {
    return [];
  }
  return [{ instancePath: path, keyword: 'type', message: `Dialogue "${path}" must be a non-empty string.` }];
}

function optionalNumberIssue(value: JsonValue | undefined, path: string): DialogueInputIssue[] {
  if (value === undefined || (typeof value === 'number' && Number.isFinite(value))) {
    return [];
  }
  return [{ instancePath: path, keyword: 'type', message: `Dialogue "${path}" must be a number.` }];
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
