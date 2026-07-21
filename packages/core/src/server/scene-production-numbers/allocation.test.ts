import { describe, expect, it } from 'vitest';
import {
  formatSceneProductionNumber,
  normalizeSceneProductionNumber,
} from '../../client/scene-production-numbers.js';
import { planSceneProductionNumberAllocations } from './allocation.js';

describe('production scene number allocation', () => {
  it('normalizes canonical input and formats a two-digit display stem', () => {
    expect(normalizeSceneProductionNumber(' 022a ')).toBe('22A');
    expect(normalizeSceneProductionNumber('0')).toBeNull();
    expect(normalizeSceneProductionNumber('A22')).toBeNull();
    expect(formatSceneProductionNumber('1')).toBe('01');
    expect(formatSceneProductionNumber('9A')).toBe('09A');
    expect(formatSceneProductionNumber('22A')).toBe('22A');
    expect(formatSceneProductionNumber('100')).toBe('100');
  });

  it('allocates initial and appended scenes with whole numbers', () => {
    expect(plan({ before: [], after: ['a', 'b'], reservations: [] })).toEqual([
      { productionNumber: '1', sceneId: 'a' },
      { productionNumber: '2', sceneId: 'b' },
    ]);
    expect(plan({
      before: ['a', 'b'],
      after: ['a', 'b', 'c', 'd'],
      reservations: [['1', 'a'], ['2', 'b'], ['3A', 'omitted']],
    })).toEqual([
      { productionNumber: '4', sceneId: 'c' },
      { productionNumber: '5', sceneId: 'd' },
    ]);
  });

  it('allocates inserted suffixes without reusing omitted reservations', () => {
    expect(plan({
      before: ['a', 'b'],
      after: ['a', 'new', 'b'],
      reservations: [['22', 'a'], ['23', 'b']],
    })).toEqual([{ productionNumber: '22A', sceneId: 'new' }]);
    expect(plan({
      before: ['a', 'b'],
      after: ['a', 'new-a', 'new-b', 'b'],
      reservations: [['22', 'a'], ['23', 'b'], ['22A', 'omitted']],
    })).toEqual([
      { productionNumber: '22B', sceneId: 'new-a' },
      { productionNumber: '22C', sceneId: 'new-b' },
    ]);
  });

  it('continues suffix allocation from Z to AA', () => {
    const reservations: Array<[string, string]> = [
      ['22', 'a'],
      ['23', 'b'],
      ...Array.from({ length: 26 }, (_, index) => [
        `22${String.fromCharCode(65 + index)}`,
        `omitted-${index}`,
      ] as [string, string]),
    ];
    expect(plan({
      before: ['a', 'b'],
      after: ['a', 'new', 'b'],
      reservations,
    })).toEqual([{ productionNumber: '22AA', sceneId: 'new' }]);
  });

  it('keeps moved and restored scene reservations unchanged', () => {
    expect(plan({
      before: ['a', 'b', 'c'],
      after: ['c', 'a', 'restored'],
      reservations: [['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'restored']],
    })).toEqual([]);
  });

  it('numbers a new opening with the next whole reservation', () => {
    expect(plan({
      before: ['a', 'b'],
      after: ['opening', 'a', 'b'],
      reservations: [['1', 'a'], ['2', 'b']],
    })).toEqual([{ productionNumber: '3', sceneId: 'opening' }]);
  });

  it('fails before allocating inside an existing suffix boundary', () => {
    expect(() => plan({
      before: ['a', 'inserted', 'b'],
      after: ['a', 'new', 'inserted', 'b'],
      reservations: [['22', 'a'], ['22A', 'inserted'], ['23', 'b']],
    })).toThrowError(expect.objectContaining({ code: 'PROJECT_DATA449' }));
  });

  it('fails when a current scene has no reservation', () => {
    expect(() => plan({
      before: ['a', 'b'],
      after: ['a', 'b'],
      reservations: [['1', 'a']],
    })).toThrowError(expect.objectContaining({ code: 'PROJECT_DATA450' }));
  });
});

function plan(input: {
  before: string[];
  after: string[];
  reservations: Array<[string, string]>;
}) {
  return planSceneProductionNumberAllocations({
    beforeSceneIds: input.before,
    afterSceneIds: input.after,
    reservations: input.reservations.map(([productionNumber, sceneId]) => ({
      productionNumber,
      sceneId,
    })),
  });
}
