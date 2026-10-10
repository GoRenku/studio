import { describe, expect, it } from 'vitest';
import type {
  StudioShotPlanDialogueAudioResource,
  StudioShotPlanDialogueAudioTake,
} from '@/services/studio-shot-plan-dialogue-audio-api';
import { groupShotPlanDialogueAudio } from './shot-plan-dialogue-audio-groups';

describe('groupShotPlanDialogueAudio', () => {
  it('separates single-line Takes by line from multi-line Takes by exact range, newest first', () => {
    const groups = groupShotPlanDialogueAudio(resource([
      take('a', 5, 5, '2026-10-01T00:00:00.000Z'),
      take('b', 7, 9, '2026-10-02T00:00:00.000Z'),
      take('c', 5, 5, '2026-10-03T00:00:00.000Z'),
      take('d', 4, 4, '2026-10-01T00:00:00.000Z'),
      take('e', 7, 9, '2026-10-04T00:00:00.000Z'),
      take('f', 4, 6, '2026-10-01T00:00:00.000Z'),
    ]));

    expect(groups.byLine.map((group) => [group.number, group.takes.map((item) => item.id)])).toEqual([
      [4, ['d']],
      [5, ['c', 'a']],
    ]);
    expect(groups.byLine[1]!.line?.plainText).toBe('Bronze. Powder.');
    expect(groups.multiLine.map((group) => [`${group.start}-${group.end}`, group.takes.map((item) => item.id)])).toEqual([
      ['4-6', ['f']],
      ['7-9', ['e', 'b']],
    ]);
  });

  it('keeps a line group without text when its number is no longer in the screenplay', () => {
    const groups = groupShotPlanDialogueAudio(resource([take('a', 12, 12, '2026-10-01T00:00:00.000Z')]));

    expect(groups.byLine).toEqual([expect.objectContaining({ number: 12, line: null })]);
    expect(groups.multiLine).toEqual([]);
  });
});

function resource(takes: StudioShotPlanDialogueAudioTake[]): StudioShotPlanDialogueAudioResource {
  return {
    shotPlan: { id: 'shot_plan_1', sceneId: 'scene_1', title: 'Shot plan 02-01' },
    takes,
    lines: [
      { number: 4, speakerName: 'Constantine', castMemberId: 'cast_c', plainText: 'What would you require?' },
      { number: 5, speakerName: 'Urban', castMemberId: 'cast_u', plainText: 'Bronze. Powder.' },
    ],
    resourceKeys: [],
  };
}

function take(id: string, start: number, end: number, createdAt: string): StudioShotPlanDialogueAudioTake {
  return {
    id,
    shotPlanId: 'shot_plan_1',
    turnRange: { start, end },
    selected: false,
    createdAt,
    updatedAt: createdAt,
    audioUrl: `/audio/${id}`,
    durationSeconds: 2,
    provenance: null,
    speakers: [],
  };
}
