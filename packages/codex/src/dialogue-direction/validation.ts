import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { z } from 'zod';
import type { DialogueDirectionVoice, DialogueLineRange } from './contracts.js';
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

export function isSingleLine(range: DialogueLineRange): boolean {
  return range.start === range.end;
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
  voices: Record<string, DialogueDirectionVoice[]>,
  path: Path,
): DiagnosticIssue[] {
  return voices[voice.castMemberId]?.some((offered) => offered.castVoiceId === voice.castVoiceId)
    ? []
    : [directionIssue(path, `Cast Voice ${voice.castVoiceId} is not offered for Cast Member ${voice.castMemberId} in this panel.`)];
}

export function parseDirectionInput<TSchema extends z.ZodType>(schema: TSchema, value: unknown, path: Path): z.infer<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    assertNoDirectionIssues(parsed.error.issues.map((issue) => directionIssue([...path, ...issue.path.map(String)], issue.message)), 'The panel draft is invalid.');
  }
  return parsed.data as z.infer<TSchema>;
}
