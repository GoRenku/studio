import { describe, expect, it } from 'vitest';
import type {
  SceneShot,
} from '@gorenku/studio-core/client';
import {
  buildShotGroupingProjection,
  createShotGroupDraftsFromTakeGenerations,
  cycleShotGroupMembership,
  groupShotLabels,
  groupTagLabel,
  shotGroupsForSave,
  type TakeScopedShotGroupDraft,
} from './shot-video-take-grouping';

function shot(id: string): SceneShot {
  return {
    shotId: id,
    title: id,
    storyBeat: '',
    narrativePurpose: '',
    description: '',
    shotType: 'wide',
    subject: '',
    action: '',
    dialogue: [],
    coveredBlockIndexes: [],
    castMemberIds: [],
    locationIds: [],
  };
}

const SHOTS = ['s1', 's2', 's3', 's4', 's5'].map(shot);

function take(
  takeId: string,
  shotIds: string[]
): { takeId: string; shotIds: string[] } {
  return { takeId, shotIds };
}

function draft(
  draftGroupId: string,
  shotIds: string[],
  input: Partial<TakeScopedShotGroupDraft> = {}
): TakeScopedShotGroupDraft {
  return { draftGroupId, shotIds, ...input };
}

function cycle(
  groups: TakeScopedShotGroupDraft[],
  clickedShotId: string,
  ids: string[] = ['new_group']
): TakeScopedShotGroupDraft[] {
  let nextIdIndex = 0;
  return cycleShotGroupMembership({
    shots: SHOTS,
    draftGroups: groups,
    clickedShotId,
    createDraftGroupId: () => ids[nextIdIndex++] ?? `new_group_${nextIdIndex}`,
  });
}

function shotIds(groups: TakeScopedShotGroupDraft[]): string[][] {
  return groups.map((group) => group.shotIds);
}

function expectOrderedNonOverlappingGroups(
  groups: TakeScopedShotGroupDraft[]
) {
  const seenShotIds = new Set<string>();
  let previousFirstShotIndex = -1;
  const shotIndexById = new Map(SHOTS.map((shot, index) => [shot.shotId, index]));

  groups.forEach((group) => {
    const indexes = group.shotIds.map((shotId) => shotIndexById.get(shotId));
    expect(indexes.every((index) => index !== undefined)).toBe(true);
    const resolvedIndexes = indexes.filter(
      (index): index is number => index !== undefined
    );
    expect(resolvedIndexes).toEqual(
      [...resolvedIndexes].sort((left, right) => left - right)
    );
    expect(resolvedIndexes[0]).toBeGreaterThan(previousFirstShotIndex);
    previousFirstShotIndex = resolvedIndexes[0] ?? previousFirstShotIndex;
    group.shotIds.forEach((shotId) => {
      expect(seenShotIds.has(shotId)).toBe(false);
      seenShotIds.add(shotId);
    });
  });
}

describe('buildShotGroupingProjection', () => {
  it('marks one-shot and multi-shot group bounds with alternating variants', () => {
    const projection = buildShotGroupingProjection(SHOTS, [
      draft('g1', ['s1']),
      draft('g2', ['s3', 's4']),
    ]);
    expect(projection.entries[0]).toMatchObject({
      takeId: 'g1',
      groupSize: 1,
      isGroupStart: true,
      isGroupEnd: true,
      variant: 0,
    });
    expect(projection.entries[2].variant).toBe(1);
    expect(projection.entries[3].isGroupEnd).toBe(true);
    expect(projection.entries[1].takeId).toBeNull();
  });

  it('ignores stale group shot ids that are not in the active shot list', () => {
    const projection = buildShotGroupingProjection(SHOTS, [
      draft('stale_group', ['missing_shot']),
    ]);

    expect(projection.entries.map((entry) => entry.takeId)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('cycleShotGroupMembership', () => {
  it('creates one-shot groups at the first and last shot boundaries', () => {
    expect(shotIds(cycle([], 's1'))).toEqual([['s1']]);
    expect(shotIds(cycle([], 's5'))).toEqual([['s5']]);
  });

  it('joins direct neighbor groups at the first and last shot boundaries', () => {
    expect(shotIds(cycle([draft('g1', ['s2', 's3'])], 's1'))).toEqual([
      ['s1', 's2', 's3'],
    ]);
    expect(shotIds(cycle([draft('g1', ['s3', 's4'])], 's5'))).toEqual([
      ['s3', 's4', 's5'],
    ]);
  });

  it('creates and clears an isolated one-shot group', () => {
    const created = cycle([], 's3');
    expect(shotIds(created)).toEqual([['s3']]);
    expect(cycle(created, 's3')).toEqual([]);
  });

  it('extends an adjacent one-shot group into a two-shot group', () => {
    const result = cycle([draft('g1', ['s3'])], 's4');
    expect(shotIds(result)).toEqual([['s3', 's4']]);
  });

  it('joins and then leaves a direct group above', () => {
    const joined = cycle([draft('g1', ['s1', 's2'])], 's3');
    expect(shotIds(joined)).toEqual([['s1', 's2', 's3']]);
    expect(shotIds(cycle(joined, 's3'))).toEqual([['s1', 's2']]);
  });

  it('joins and then leaves a direct group below', () => {
    const joined = cycle([draft('g1', ['s3', 's4'])], 's2');
    expect(shotIds(joined)).toEqual([['s2', 's3', 's4']]);
    expect(shotIds(cycle(joined, 's2'))).toEqual([['s3', 's4']]);
  });

  it('cycles an ambiguous gap above, below, merged, then none', () => {
    const start = [
      draft('g1', ['s1', 's2'], { takeId: 'g1' }),
      draft('g2', ['s4', 's5'], { takeId: 'g2' }),
    ];
    const above = cycle(start, 's3');
    expect(shotIds(above)).toEqual([
      ['s1', 's2', 's3'],
      ['s4', 's5'],
    ]);

    const below = cycle(above, 's3');
    expect(shotIds(below)).toEqual([
      ['s1', 's2'],
      ['s3', 's4', 's5'],
    ]);
    expect(below).toHaveLength(2);

    const merged = cycle(below, 's3');
    expect(shotIds(merged)).toEqual([['s1', 's2', 's3', 's4', 's5']]);
    expect(merged[0].takeId).toBe('g1');
    expect(merged[0].mergePartnerTakeGenerationId).toBe('g2');

    const cleared = cycle(merged, 's3');
    expect(shotIds(cleared)).toEqual([
      ['s1', 's2'],
      ['s4', 's5'],
    ]);
  });

  it('removes top and bottom edge shots without creating empty groups', () => {
    expect(shotIds(cycle([draft('g1', ['s1', 's2', 's3'])], 's1'))).toEqual([
      ['s2', 's3'],
    ]);
    expect(shotIds(cycle([draft('g1', ['s1', 's2', 's3'])], 's3'))).toEqual([
      ['s1', 's2'],
    ]);
  });

  it('leaves a one-shot group behind when a two-shot edge leaves', () => {
    expect(shotIds(cycle([draft('g1', ['s1', 's2'])], 's2'))).toEqual([
      ['s1'],
    ]);
  });

  it('splits a middle shot into upper and lower groups', () => {
    const result = cycle(
      [draft('g1', ['s1', 's2', 's3', 's4', 's5'], { takeId: 'g1' })],
      's3',
      ['lower']
    );
    expect(shotIds(result)).toEqual([
      ['s1', 's2'],
      ['s4', 's5'],
    ]);
    expect(result[0].takeId).toBe('g1');
    expect(result[1].sourceTakeGenerationId).toBe('g1');
  });

  it('splits a three-shot group into two one-shot groups', () => {
    const result = cycle(
      [draft('g1', ['s1', 's2', 's3'], { takeId: 'g1' })],
      's2',
      ['lower']
    );
    expect(shotIds(result)).toEqual([['s1'], ['s3']]);
    expect(result[1].sourceTakeGenerationId).toBe('g1');
  });

  it('cycles the middle shot after a split through above, below, merged, none', () => {
    const split = [
      draft('g1', ['s1'], { takeId: 'g1' }),
      draft('lower', ['s3'], { sourceTakeGenerationId: 'g1' }),
    ];
    expect(shotIds(cycle(split, 's2'))).toEqual([
      ['s1', 's2'],
      ['s3'],
    ]);
    const below = cycle(cycle(split, 's2'), 's2');
    expect(shotIds(below)).toEqual([['s1'], ['s2', 's3']]);
    const merged = cycle(below, 's2');
    expect(shotIds(merged)).toEqual([['s1', 's2', 's3']]);
    expect(shotIds(cycle(merged, 's2'))).toEqual([['s1'], ['s3']]);
  });

  it('drops stale shot ids before applying a new local click', () => {
    const result = cycle(
      [
        draft('stale_group', ['missing_shot'], {
          takeId: 'stale_group',
        }),
      ],
      's2'
    );

    expect(shotIds(result)).toEqual([['s2']]);
  });

  it('keeps representative cycle outputs ordered and non-overlapping', () => {
    const split = cycle(
      [draft('g1', ['s5', 's3', 's1', 's2', 's4'])],
      's3',
      ['lower']
    );
    expect(shotIds(split)).toEqual([
      ['s1', 's2'],
      ['s4', 's5'],
    ]);
    expectOrderedNonOverlappingGroups(split);

    const joined = cycle(split, 's3');
    expect(shotIds(joined)).toEqual([
      ['s1', 's2', 's3'],
      ['s4', 's5'],
    ]);
    expectOrderedNonOverlappingGroups(joined);
  });
});

describe('save projection and labels', () => {
  it('creates drafts from take generations', () => {
    expect(
      createShotGroupDraftsFromTakeGenerations([
        take('take_generation_1', ['s2']),
      ])
    ).toEqual([
      {
        draftGroupId: 'take_generation_1',
        takeId: 'take_generation_1',
        shotIds: ['s2'],
      },
    ]);
  });

  it('serializes one-shot and split groups without empty shot ids', () => {
    expect(
      shotGroupsForSave([
        draft('g1', ['s1'], { takeId: 'g1' }),
        draft('lower', ['s3'], { sourceTakeGenerationId: 'g1' }),
      ])
    ).toEqual([
      { takeId: 'g1', shotIds: ['s1'] },
      { sourceTakeGenerationId: 'g1', shotIds: ['s3'] },
    ]);
  });

  it('serializes unsaved merges with the upper take generation id and merge partner id', () => {
    const above = cycle(
      [
        draft('g1', ['s1', 's2'], { takeId: 'g1' }),
        draft('g2', ['s4', 's5'], { takeId: 'g2' }),
      ],
      's3'
    );
    const below = cycle(above, 's3');
    const merged = cycle(below, 's3');

    expect(shotGroupsForSave(merged)).toEqual([
      {
        takeId: 'g1',
        mergePartnerTakeGenerationId: 'g2',
        shotIds: ['s1', 's2', 's3', 's4', 's5'],
      },
    ]);
  });

  it('renders meaningful labels for one-shot and multi-shot groups', () => {
    expect(groupShotLabels(SHOTS, { shotIds: ['s3', 's4'] })).toEqual([
      'Shot 3',
      'Shot 4',
    ]);
    expect(groupTagLabel(SHOTS, { shotIds: ['s3'] })).toBe('Shot 3');
    expect(groupTagLabel(SHOTS, { shotIds: ['s3', 's4'] })).toBe('Shot 3-4');
  });
});
