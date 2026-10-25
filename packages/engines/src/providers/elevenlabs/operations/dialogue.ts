import type { JsonValue } from '../../../media/contracts.js';
import { EngineError, isEngineError } from '../../../shared/errors.js';
import { validateJsonSchema } from '../../../shared/json-schema-validation.js';
import { outputFormat, saveElevenLabsAudioStream } from '../audio-output.js';
import { requestElevenLabsAudio } from '../client.js';
import { elevenLabsDialogueInputSchema } from './dialogue-schema.js';
import type { ElevenLabsOperation } from './registry.js';
import { isJsonObject } from '../../../shared/json-object.js';

const MAX_DISTINCT_VOICES = 10;

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
  inputSchema: elevenLabsDialogueInputSchema,
  validate(input, target) {
    const issues = [...schemaIssues(input, target.model), ...distinctVoiceIssues(input.inputs)];
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

function schemaIssues(input: Record<string, JsonValue>, model: string): DialogueInputIssue[] {
  try {
    validateJsonSchema({ provider: 'elevenlabs', model, schema: elevenLabsDialogueInputSchema, value: input });
    return [];
  } catch (error) {
    if (isEngineError(error) && error.code === 'ENGINE_REQUEST_INVALID' && Array.isArray(error.details)) {
      return error.details as unknown as DialogueInputIssue[];
    }
    throw error;
  }
}

/** The one dialogue rule JSON Schema cannot express. */
function distinctVoiceIssues(value: JsonValue | undefined): DialogueInputIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const voices = new Set(value.flatMap((line) => (
    isJsonObject(line) && typeof line.voice === 'string' ? [line.voice] : []
  )));
  if (voices.size <= MAX_DISTINCT_VOICES) {
    return [];
  }
  return [{
    instancePath: '/inputs',
    keyword: 'maxDistinctVoices',
    message: `ElevenLabs dialogue allows at most ${MAX_DISTINCT_VOICES} distinct voices; received ${voices.size}.`,
  }];
}

function dialogueSettings(value: JsonValue | undefined): DialogueSettings | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }
  return {
    ...(typeof value.stability === 'number' ? { stability: value.stability } : {}),
    ...(typeof value.similarity === 'number' ? { similarity: value.similarity } : {}),
  };
}
