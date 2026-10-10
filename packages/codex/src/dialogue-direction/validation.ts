import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { z } from 'zod';
import type { DialogueDirectionDraft, DialogueDirectionLine, DialogueDirectionVoice, DialogueLineRange } from './contracts.js';
import { assertNoDirectionIssues, directionIssue } from './diagnostics.js';

type Path = Array<string | number>;

export interface DirectionSpeakingLine {
  number: number;
  castMemberId: string | null;
  speakerName: string;
}

/** Checks ordering and that the range lies within `bounds`. */
export function lineRangeIssues(range: DialogueLineRange, bounds: DialogueLineRange, path: Path): DiagnosticIssue[] {
  if (range.start > range.end) return [directionIssue(path, `Line range ${range.start}–${range.end} must be ascending.`)];
  if (range.start < bounds.start || range.end > bounds.end) {
    return [directionIssue(path, `Line range ${range.start}–${range.end} must lie within lines ${bounds.start}–${bounds.end}.`)];
  }
  return [];
}

export function linesInRange<TLine extends { number: number }>(lines: TLine[], range: DialogueLineRange): TLine[] {
  return lines.filter((line) => line.number >= range.start && line.number <= range.end);
}

/** Distinct Cast Member speakers in screenplay order of first appearance, with issues for lines that have no Cast Member. */
export function speakersInOrder(lines: DirectionSpeakingLine[], path: Path): { castMemberIds: string[]; issues: DiagnosticIssue[] } {
  const castMemberIds: string[] = [];
  const issues: DiagnosticIssue[] = [];
  for (const line of lines) {
    if (!line.castMemberId) {
      issues.push(directionIssue(path, `Line ${line.number} (${line.speakerName}) has no Cast Member speaker, so no Cast Voice can perform it.`));
    } else if (!castMemberIds.includes(line.castMemberId)) {
      castMemberIds.push(line.castMemberId);
    }
  }
  return { castMemberIds, issues };
}

export function duplicateIssues(values: string[], path: Path, label: string): DiagnosticIssue[] {
  return values
    .filter((value, index) => values.indexOf(value) !== index)
    .map((value) => directionIssue(path, `${label} ${value} is listed more than once.`));
}

export function voiceAllowedIssues(
  voice: { castMemberId: string; castVoiceId: string },
  allowedVoiceIds: Record<string, string[]>,
  path: Path,
): DiagnosticIssue[] {
  return allowedVoiceIds[voice.castMemberId]?.includes(voice.castVoiceId)
    ? []
    : [directionIssue(path, `Cast Voice ${voice.castVoiceId} is not offered for Cast Member ${voice.castMemberId} in this panel.`)];
}

export interface DraftValidationContext {
  lines: DialogueDirectionLine[];
  voices: Record<string, DialogueDirectionVoice[]>;
}

/** Validates one panel's Generate draft against its session, collecting every issue. */
export type DraftValidator = (draft: unknown, context: DraftValidationContext) => DialogueDirectionDraft;

export function parseDraft<TSchema extends z.ZodType>(schema: TSchema, draft: unknown): z.infer<TSchema> {
  const parsed = schema.safeParse(draft);
  if (!parsed.success) {
    assertNoDirectionIssues(parsed.error.issues.map((issue) => directionIssue(['draft', ...issue.path.map(String)], issue.message)), 'The panel draft is invalid.');
  }
  return parsed.data as z.infer<TSchema>;
}

export function sessionLineBounds(lines: DialogueDirectionLine[]): DialogueLineRange {
  return { start: lines[0]?.number ?? 1, end: lines.at(-1)?.number ?? 0 };
}

export function allowedVoiceIds(voices: Record<string, DialogueDirectionVoice[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(voices).map(([castMemberId, entries]) => [castMemberId, entries.map((voice) => voice.castVoiceId)]));
}
