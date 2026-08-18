import { describe, expect, it } from 'vitest';
import type { AssetOwner, AssetSelectionTarget } from '../../client/assets.js';
import {
  assetSelectionTargetForOwnerType,
} from './selection.js';
import { selectionTargetOwner } from './selection-targets.js';

describe('Asset selection capability', () => {
  it.each<{
    owner: AssetOwner;
    type: string;
    target: AssetSelectionTarget;
  }>([
    {
      owner: { kind: 'castMember', id: 'cast_1' },
      type: 'cast_profile',
      target: { kind: 'castMember', id: 'cast_1' },
    },
    {
      owner: { kind: 'location', id: 'location_1' },
      type: 'location_hero',
      target: { kind: 'location', id: 'location_1' },
    },
    {
      owner: { kind: 'location', id: 'location_1' },
      type: 'location_world',
      target: { kind: 'locationWorld', id: 'location_1' },
    },
    {
      owner: { kind: 'prop', id: 'prop_1' },
      type: 'prop_hero',
      target: { kind: 'prop', id: 'prop_1' },
    },
    {
      owner: { kind: 'lookbook', id: 'lookbook_1' },
      type: 'lookbook_image',
      target: { kind: 'lookbook', id: 'lookbook_1' },
    },
    {
      owner: { kind: 'shot', id: 'shot_1' },
      type: 'shot_image',
      target: { kind: 'shot', id: 'shot_1' },
    },
    {
      owner: {
        kind: 'sceneBeat',
        sceneId: 'scene_1',
        beatId: 'beat_1',
      },
      type: 'scene_storyboard_image',
      target: {
        kind: 'sceneBeat',
        sceneId: 'scene_1',
        beatId: 'beat_1',
      },
    },
  ])('maps $type to its one canonical target', ({ owner, type, target }) => {
    expect(assetSelectionTargetForOwnerType(owner, type)).toEqual(target);
    expect(selectionTargetOwner(target)).toEqual(owner);
  });

  it.each([
    [{ kind: 'project' } as const, 'cast_profile'],
    [{ kind: 'castMember', id: 'cast_1' } as const, 'character_sheet'],
    [{ kind: 'location', id: 'location_1' } as const, 'location_sheet'],
    [{ kind: 'prop', id: 'prop_1' } as const, 'prop_sheet'],
    [{ kind: 'lookbook', id: 'lookbook_1' } as const, 'lookbook_sheet'],
    [{ kind: 'scene', id: 'scene_1' } as const, 'scene_dialogue_audio'],
  ])('rejects request-scoped or unsupported selection for %j', (owner, type) => {
    expect(() => assetSelectionTargetForOwnerType(owner, type)).toThrow(
      expect.objectContaining({ code: 'CORE_ASSET_SELECTION_UNSUPPORTED' })
    );
  });
});
