import { describe, expect, it } from 'vitest';
import type { AssetFileOwner } from '../../client/asset-files.js';
import { assetFileOwnerKey, parseAssetFileOwnerKey } from './owner-keys.js';

describe('Asset owner keys', () => {
  it('round-trips every owner kind and encodes delimiter characters', () => {
    const owners: AssetFileOwner[] = [
      { kind: 'project' },
      { kind: 'castMember', id: 'cast:one/two' },
      { kind: 'location', id: 'location one' },
      { kind: 'prop', id: 'prop one' },
      { kind: 'scene', id: 'scene:one' },
      {
        kind: 'sceneBeat',
        sceneId: 'scene:one',
        beatId: 'beat/two',
      },
      { kind: 'lookbook', id: 'lookbook one' },
      { kind: 'shot', id: 'shot:one' },
    ];

    for (const owner of owners) {
      expect(parseAssetFileOwnerKey(assetFileOwnerKey(owner))).toEqual(owner);
    }
    expect(assetFileOwnerKey({
      kind: 'sceneBeat',
      sceneId: 'scene:one',
      beatId: 'beat/two',
    })).toBe('sceneBeat:scene%3Aone:beat%2Ftwo');
  });

  it.each([
    '',
    'project:extra',
    'cast:cast_1',
    'castMember:',
    'sceneBeat:scene_1',
    'sceneBeat:scene_1:',
    'sceneBeat:scene_1:beat_1:extra',
    'shot:%E0%A4%A',
  ])('rejects malformed stored key %s', (ownerKey) => {
    expect(() => parseAssetFileOwnerKey(ownerKey)).toThrow(
      expect.objectContaining({ code: 'CORE_ASSET_STORAGE_INVALID' })
    );
  });

  it('rejects empty typed owner ids before storage', () => {
    expect(() => assetFileOwnerKey({ kind: 'shot', id: '' })).toThrow(
      expect.objectContaining({ code: 'CORE_ASSET_OWNER_INVALID' })
    );
  });
});
