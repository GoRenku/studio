import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { z } from 'zod';
import type { SeedAudioDirectionDraft } from '../contracts.js';
import { assertNoDirectionIssues, directionIssue } from '../diagnostics.js';
import { directionIdentity, lineRangeSchema } from '../schemas.js';
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

export const SEED_AUDIO_MAX_VOICE_REFERENCES = 3;

const seedAudioDraftSchema = z.object({
  panel: z.literal('seed-audio'),
  turnRange: lineRangeSchema,
  prompt: z.string(),
  voiceReferences: z.array(z.object({
    position: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    castMemberId: directionIdentity,
    castVoiceId: directionIdentity,
  }).strict()).min(1),
}).strict();

export function validateSeedAudioDraft(draft: unknown, context: DraftValidationContext): SeedAudioDirectionDraft {
  const parsed = parseDraft(seedAudioDraftSchema, draft);
  assertNoDirectionIssues(lineRangeIssues(parsed.turnRange, sessionLineBounds(context.lines), ['draft', 'turnRange']), 'The panel draft is invalid.');
  const speakers = speakersInOrder(linesInRange(context.lines, parsed.turnRange), ['draft', 'turnRange']);
  assertNoDirectionIssues([
    ...speakers.issues,
    ...voiceReferenceIssues(parsed.voiceReferences, speakers.castMemberIds, allowedVoiceIds(context.voices)),
  ], 'The panel draft is invalid.');
  return parsed;
}

/** One reference per distinct speaker, in order of first appearance, at sequential positions, at most three. */
function voiceReferenceIssues(
  references: SeedAudioDirectionDraft['voiceReferences'],
  speakers: string[],
  allowed: Record<string, string[]>,
): DiagnosticIssue[] {
  if (speakers.length > SEED_AUDIO_MAX_VOICE_REFERENCES) {
    return [directionIssue(['draft', 'turnRange'], `Seed Audio takes up to ${SEED_AUDIO_MAX_VOICE_REFERENCES} voices; the selected lines have ${speakers.length} speakers.`)];
  }
  const countIssues = references.length === speakers.length
    ? []
    : [directionIssue(['draft', 'voiceReferences'], `Expected one voice reference for each of the ${speakers.length} speakers.`)];
  return [
    ...countIssues,
    ...references.flatMap((reference, index) => [
      ...(reference.position === index + 1 ? [] : [directionIssue(['draft', 'voiceReferences', index, 'position'], `Voice reference ${index + 1} must have position ${index + 1}.`)]),
      ...(reference.castMemberId === speakers[index] ? [] : [directionIssue(['draft', 'voiceReferences', index, 'castMemberId'], `Voice reference ${index + 1} must be the speaker who appears ${ordinal(index + 1)}.`)]),
      ...voiceAllowedIssues(reference, allowed, ['draft', 'voiceReferences', index]),
    ]),
  ];
}

function ordinal(position: number): string {
  return ['first', 'second', 'third'][position - 1] ?? `at position ${position}`;
}
