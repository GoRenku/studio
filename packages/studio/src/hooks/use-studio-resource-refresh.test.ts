import { describe, expect, it } from 'vitest';
import {
  matchesActStoryboardResource,
  matchesSceneShotsResource,
  matchesSequenceResource,
} from './use-studio-resource-refresh';

describe('Studio resource refresh matchers', () => {
  it('matches broad scene-shot-list changes for the scene shots surface', () => {
    expect(
      matchesSceneShotsResource({
        resourceKeys: ['scene-shot-list'],
        sceneId: 'scene_bombardment',
        shotListId: 'scene_shot_list_bombardment',
      })
    ).toBe(true);
  });

  it('matches broad scene-shot-list changes for storyboard surfaces', () => {
    expect(
      matchesSequenceResource({
        resourceKeys: ['scene-shot-list'],
        sequenceId: 'sequence_siege',
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
    expect(
      matchesActStoryboardResource({
        resourceKeys: ['scene-shot-list'],
        actId: 'act_one',
        sequenceIds: new Set(['sequence_siege']),
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
  });
});
