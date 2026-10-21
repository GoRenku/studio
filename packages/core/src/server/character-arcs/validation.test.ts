import { describe, expect, it } from 'vitest';
import type { CharacterArc, CharacterArcsWriteDocument } from '../../client/character-arcs/model.js';
import { assertCharacterArcsWriteDocument, type CharacterArcValidationContext } from './validation.js';

const context: CharacterArcValidationContext = {
  castMemberIds: new Set(['cast_will']),
  sceneOrder: new Map([['scene_2', 0], ['scene_5', 1], ['scene_31', 2], ['scene_118', 3]]),
  assetFiles: new Map(),
};

function arcWithTurningPoints(turningPoints: CharacterArc['turningPoints']): CharacterArcsWriteDocument {
  return {
    kind: 'characterArcs',
    arcs: [{
      castMemberId: 'cast_will',
      arc: {
        kind: 'characterArc',
        arcType: 'positiveChange',
        startState: 'The stories are lies.',
        endState: 'The stories are who he is.',
        ends: { high: 'The stories are who he is', low: 'The stories are lies' },
        spine: {
          want: { text: 'The true versions of things.', sceneIds: ['scene_31'] },
          need: { text: 'To accept his father.', sceneIds: ['scene_31'] },
          falseBelief: { text: 'The stories hide the real man.', sceneIds: ['scene_118'] },
        },
        turningPoints,
      },
    }],
  };
}

describe('character arc scene order', () => {
  it('accepts turning points in screenplay order, sharing a first scene', () => {
    expect(() => assertCharacterArcsWriteDocument({
      document: arcWithTurningPoints([
        { sceneIds: ['scene_2'], label: 'Believer', state: 'Enthralled.', position: 4 },
        { sceneIds: ['scene_5', 'scene_31'], label: 'Rupture', state: 'Furious.', position: -5 },
        { sceneIds: ['scene_5'], label: 'Silence', state: 'Withdrawn.', position: -4 },
      ]),
      readContext: () => context,
    })).not.toThrow();
    expect(() => assertCharacterArcsWriteDocument({
      document: arcWithTurningPoints([
        { sceneIds: ['scene_2'], label: 'Believer', state: 'Enthralled.', position: 4 },
        { sceneIds: ['scene_5', 'scene_31'], label: 'Rupture', state: 'Furious.', position: -5 },
        { sceneIds: ['scene_31'], label: 'True versions', state: 'Wants facts.', position: -4 },
      ]),
      readContext: () => context,
    })).not.toThrow();
  });

  it('reports turning points out of order and scenes out of order within one turning point', () => {
    let issues: Array<{ message: string }> = [];
    try {
      assertCharacterArcsWriteDocument({
        document: arcWithTurningPoints([
          { sceneIds: ['scene_118'], label: 'Confrontation', state: 'Lowest point.', position: -5 },
          { sceneIds: ['scene_31', 'scene_5'], label: 'True versions', state: 'Wants facts.', position: -4 },
        ]),
        readContext: () => context,
      });
    } catch (error) {
      issues = (error as { issues: Array<{ message: string }> }).issues;
    }
    expect(issues.map((entry) => entry.message)).toEqual([
      'Scene ids within a turning point must follow screenplay order.',
      'Turning points must follow screenplay order by their first Scene.',
    ]);
  });
});
