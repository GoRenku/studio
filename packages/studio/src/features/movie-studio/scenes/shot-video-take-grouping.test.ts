import { describe, expect, it } from 'vitest';
import type {
  SceneShot,
  ShotVideoTakeProductionGroup,
} from '@gorenku/studio-core/client';
import {
  buildShotGroupingProjection,
  cycleShotGroupMembership,
  groupShotLabels,
  groupTagLabel,
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

function group(
  id: string,
  shotIds: string[]
): ShotVideoTakeProductionGroup {
  return { productionGroupId: id, shotIds, videoTakeProduction: {} };
}

function indexes(
  shots: SceneShot[],
  groupResult: ShotVideoTakeProductionGroup
): number[] {
  const order = new Map(shots.map((entry, index) => [entry.shotId, index]));
  return groupResult.shotIds
    .map((shotId) => order.get(shotId) ?? -1)
    .sort((a, b) => a - b);
}

function isContiguous(values: number[]): boolean {
  return values.every(
    (value, index) => index === 0 || value === values[index - 1] + 1
  );
}

describe('buildShotGroupingProjection', () => {
  it('marks group bounds and alternates adjacent group variants', () => {
    const projection = buildShotGroupingProjection(SHOTS, [
      group('g1', ['s1', 's2']),
      group('g2', ['s4', 's5']),
    ]);
    expect(projection.entries[0].variant).toBe(0);
    expect(projection.entries[0].isGroupStart).toBe(true);
    expect(projection.entries[1].isGroupEnd).toBe(true);
    expect(projection.entries[3].variant).toBe(1);
    expect(projection.entries[2].productionGroupId).toBeNull();
  });
});

describe('cycleShotGroupMembership', () => {
  it('creates a single-shot group for an isolated shot', () => {
    const result = cycleShotGroupMembership(SHOTS, [], 's3', {
      createGroupId: () => 'new_group',
    });
    expect(result).toHaveLength(1);
    expect(result[0].shotIds).toEqual(['s3']);
  });

  it('only ever creates contiguous groups', () => {
    const result = cycleShotGroupMembership(
      SHOTS,
      [group('g1', ['s1', 's2'])],
      's3',
      { createGroupId: () => 'new_group' }
    );
    result.forEach((groupResult) =>
      expect(isContiguous(indexes(SHOTS, groupResult))).toBe(true)
    );
  });

  it('splits one group into two when a middle shot is removed', () => {
    const result = cycleShotGroupMembership(
      SHOTS,
      [group('g1', ['s2', 's3', 's4'])],
      's3',
      { createGroupId: () => 'split_group' }
    );
    expect(result).toHaveLength(2);
    const allShots = result.flatMap((groupResult) => groupResult.shotIds);
    expect(allShots).not.toContain('s3');
    expect(result.map((groupResult) => groupResult.shotIds).sort()).toEqual([
      ['s2'],
      ['s4'],
    ]);
  });

  it('never merges two adjacent groups in one click', () => {
    const result = cycleShotGroupMembership(
      SHOTS,
      [group('g1', ['s1', 's2']), group('g2', ['s4', 's5'])],
      's3',
      { createGroupId: () => 'new_group' }
    );
    // s3 joins the upper group; the two groups stay distinct.
    expect(result).toHaveLength(2);
    result.forEach((groupResult) =>
      expect(isContiguous(indexes(SHOTS, groupResult))).toBe(true)
    );
  });
});

describe('group labels', () => {
  it('renders meaningful shot labels', () => {
    expect(groupShotLabels(SHOTS, group('g1', ['s3', 's4']))).toEqual([
      'Shot 3',
      'Shot 4',
    ]);
  });

  it('builds a quiet group tag for multi-shot groups', () => {
    expect(groupTagLabel(SHOTS, group('g1', ['s3', 's4']))).toBe('Shot 3-4');
    expect(groupTagLabel(SHOTS, group('g1', ['s3']))).toBeNull();
  });
});
