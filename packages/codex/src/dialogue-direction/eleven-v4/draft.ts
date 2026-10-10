import type { ShotPlanDialogueAudioTake } from '@gorenku/studio-core/client';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { z } from 'zod';
import type { DialogueDirectionRoute, ElevenV4DirectionDraft } from '../contracts.js';
import { assertNoDirectionIssues, directionIssue } from '../diagnostics.js';
import { directionIdentity, directionUnitIntervalSchema, lineRangeSchema } from '../schemas.js';
import {
  allowedVoiceIds,
  lineRangeIssues,
  linesInRange,
  parseDraft,
  sessionLineBounds,
  speakersInOrder,
  voiceAllowedIssues,
  type DraftValidationContext,
} from '../validation.js';

const ELEVENLABS_PROVIDER = 'elevenlabs';

export const elevenV4VoiceSettingsSchema = z.object({
  stability: directionUnitIntervalSchema,
  similarity: directionUnitIntervalSchema,
}).strict();

export const elevenV4ActingLineSchema = z.object({
  number: z.number().int().positive(),
  actingScript: z.string(),
}).strict();

const elevenV4DraftSchema = z.object({
  panel: z.literal('eleven-v4'),
  turnRange: lineRangeSchema,
  lines: z.array(elevenV4ActingLineSchema).min(1),
  voices: z.array(z.object({ castMemberId: directionIdentity, castVoiceId: directionIdentity }).strict()).min(1),
  voiceSettings: elevenV4VoiceSettingsSchema,
}).strict();

export function validateElevenV4Draft(draft: unknown, context: DraftValidationContext): ElevenV4DirectionDraft {
  const parsed = parseDraft(elevenV4DraftSchema, draft);
  const rangeIssues = lineRangeIssues(parsed.turnRange, sessionLineBounds(context.lines), ['draft', 'turnRange']);
  assertNoDirectionIssues(rangeIssues, 'The panel draft is invalid.');
  const rangeLines = linesInRange(context.lines, parsed.turnRange);
  const speakers = speakersInOrder(rangeLines, ['draft', 'turnRange']);
  assertNoDirectionIssues([
    ...actingLineIssues(parsed.lines.map((line) => line.number), rangeLines.map((line) => line.number)),
    ...speakers.issues,
    ...voiceIssues(parsed.voices, speakers.castMemberIds, allowedVoiceIds(context.voices)),
  ], 'The panel draft is invalid.');
  return parsed;
}

/** Recovers per-line acting scripts from Eleven v4 speech or dialogue provenance. */
export function elevenV4TakeActingScripts(take: ShotPlanDialogueAudioTake, route: DialogueDirectionRoute): Record<number, string> | null {
  const provenance = take.assetFile.generationProvenance;
  if (provenance?.provider !== ELEVENLABS_PROVIDER || !isRecord(provenance.request)) return null;
  const { start, end } = take.turnRange;
  if (provenance.model === route.speechModel && start === end && typeof provenance.request.text === 'string') {
    return { [start]: provenance.request.text };
  }
  if (provenance.model !== route.rangeModel || !Array.isArray(provenance.request.inputs)) return null;
  const texts = provenance.request.inputs.map((input) => (isRecord(input) && typeof input.text === 'string' ? input.text : null));
  if (texts.length !== end - start + 1 || texts.some((text) => text === null)) return null;
  return Object.fromEntries(texts.map((text, index) => [start + index, text!]));
}

function actingLineIssues(numbers: number[], expected: number[]): DiagnosticIssue[] {
  return numbers.length === expected.length && numbers.every((number, index) => number === expected[index])
    ? []
    : [directionIssue(['draft', 'lines'], `Acting scripts must cover lines ${expected.join(', ')} once each, in screenplay order.`)];
}

function voiceIssues(
  voices: ElevenV4DirectionDraft['voices'],
  speakers: string[],
  allowed: Record<string, string[]>,
): DiagnosticIssue[] {
  const listed = voices.map((voice) => voice.castMemberId);
  return [
    ...speakers
      .filter((castMemberId) => listed.filter((candidate) => candidate === castMemberId).length !== 1)
      .map((castMemberId) => directionIssue(['draft', 'voices'], `Speaker ${castMemberId} needs exactly one voice.`)),
    ...voices.flatMap((voice, index) => speakers.includes(voice.castMemberId)
      ? voiceAllowedIssues(voice, allowed, ['draft', 'voices', index])
      : [directionIssue(['draft', 'voices', index], `Cast Member ${voice.castMemberId} does not speak in the selected lines.`)]),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
