import type { ShotPlanDialogueAudioLine } from '@gorenku/studio-core/client';
import type {
  StudioShotPlanDialogueAudioResource,
  StudioShotPlanDialogueAudioTake,
} from '@/services/studio-shot-plan-dialogue-audio-api';

export interface DialogueAudioLineGroup {
  number: number;
  line: ShotPlanDialogueAudioLine | null;
  takes: StudioShotPlanDialogueAudioTake[];
}

export interface DialogueAudioRangeGroup {
  start: number;
  end: number;
  takes: StudioShotPlanDialogueAudioTake[];
}

export interface DialogueAudioGroups {
  byLine: DialogueAudioLineGroup[];
  multiLine: DialogueAudioRangeGroup[];
}

/** Groups Takes by exact Turn range: single-line Takes per line, multi-line Takes per range. Newest Take first. */
export function groupShotPlanDialogueAudio(
  resource: StudioShotPlanDialogueAudioResource
): DialogueAudioGroups {
  const lines = new Map(resource.lines.map((line) => [line.number, line]));
  const byLine = new Map<number, DialogueAudioLineGroup>();
  const multiLine = new Map<string, DialogueAudioRangeGroup>();
  for (const take of newestFirst(resource.takes)) {
    const { start, end } = take.turnRange;
    if (start === end) {
      const group = byLine.get(start) ?? { number: start, line: lines.get(start) ?? null, takes: [] };
      group.takes.push(take);
      byLine.set(start, group);
    } else {
      const key = `${start}-${end}`;
      const group = multiLine.get(key) ?? { start, end, takes: [] };
      group.takes.push(take);
      multiLine.set(key, group);
    }
  }
  return {
    byLine: [...byLine.values()].sort((a, b) => a.number - b.number),
    multiLine: [...multiLine.values()].sort((a, b) => a.start - b.start || a.end - b.end),
  };
}

function newestFirst(takes: StudioShotPlanDialogueAudioTake[]) {
  return [...takes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
