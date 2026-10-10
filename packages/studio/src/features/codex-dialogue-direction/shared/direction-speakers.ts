import type { DialogueDirectionLine, DialogueLineRange } from '@gorenku/studio-codex/dialogue-direction';
import { dialogueLineRangeContains } from './dialogue-line-range';

export interface DirectionCastSpeaker {
  castMemberId: string;
  speakerName: string;
  profileUri: string | null;
}

export function linesInDialogueRange(lines: DialogueDirectionLine[], range: DialogueLineRange): DialogueDirectionLine[] {
  return lines.filter((line) => dialogueLineRangeContains(range, line.number));
}

/** Distinct Cast Member speakers of the lines, in order of first appearance. */
export function directionSpeakers(lines: DialogueDirectionLine[]): DirectionCastSpeaker[] {
  const speakers = new Map<string, DirectionCastSpeaker>();
  for (const line of lines) {
    if (line.castMemberId && !speakers.has(line.castMemberId)) {
      speakers.set(line.castMemberId, { castMemberId: line.castMemberId, speakerName: line.speakerName, profileUri: line.profileUri });
    }
  }
  return [...speakers.values()];
}
