import { describe, expect, it } from 'vitest';
import {
  matchesActStoryboardResource,
  matchesSceneBeatsResource,
  matchesSequenceResource,
} from './use-studio-resource-refresh';

describe('Studio resource refresh matchers', () => {
  it('matches broad Beat Sheet changes for the Scene Beats surface', () => {
    expect(
      matchesSceneBeatsResource({
        resourceKeys: ['scene-beat-sheet'],
        sceneId: 'scene_bombardment',
        beatSheetId: 'scene_beat_sheet_bombardment',
      })
    ).toBe(true);
  });

  it('matches broad Beat Sheet changes for storyboard surfaces', () => {
    expect(
      matchesSequenceResource({
        resourceKeys: ['scene-beat-sheet'],
        sequenceId: 'sequence_siege',
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
    expect(
      matchesActStoryboardResource({
        resourceKeys: ['scene-beat-sheet'],
        actId: 'act_one',
        sequenceIds: new Set(['sequence_siege']),
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
  });
});
