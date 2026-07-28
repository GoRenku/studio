import { describe, expect, it } from 'vitest';
import {
  CAMERA_ANGLE_OPTIONS,
  getCameraAngleMedia,
  getShotMovementMedia,
  getShotSizeMedia,
  MOVEMENT_OPTIONS,
  SHOT_SIZE_OPTIONS,
} from './shot-design-media';

describe('shared Shot Design media', () => {
  it('provides the accepted 9 framing, 8 camera, and 10 motion choices', () => {
    expect(SHOT_SIZE_OPTIONS).toHaveLength(9);
    expect(CAMERA_ANGLE_OPTIONS).toHaveLength(8);
    expect(MOVEMENT_OPTIONS).toHaveLength(10);
    expect(SHOT_SIZE_OPTIONS.every((option) => option.imageUrl)).toBe(true);
    expect(CAMERA_ANGLE_OPTIONS.every((option) => option.imageUrl)).toBe(true);
    expect(MOVEMENT_OPTIONS.every((option) => option.imageUrl)).toBe(true);
  });

  it('uses the same media lookups for authoring and read-only Shot Plans', () => {
    expect(getShotSizeMedia('wide-shot')).toMatchObject({ kind: 'still' });
    expect(getCameraAngleMedia('eye-level')).toMatchObject({ kind: 'still' });
    expect(getShotMovementMedia('push-in')).toMatchObject({ kind: 'motion' });
    expect(getShotMovementMedia('rack-focus')).toMatchObject({ kind: 'still' });
    expect(getShotSizeMedia('Authored custom framing')).toBeNull();
  });
});
