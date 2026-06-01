import { describe, expect, it } from 'vitest';
import { deriveShotSpecPromptStrings } from './shot-spec-labels.js';

describe('deriveShotSpecPromptStrings', () => {
  it('returns no strings for empty or absent specs', () => {
    expect(deriveShotSpecPromptStrings(undefined)).toEqual({});
    expect(deriveShotSpecPromptStrings({})).toEqual({
      shotType: undefined,
      cameraAngle: undefined,
      framing: undefined,
      lensIntent: undefined,
      cameraMovement: undefined,
    });
  });

  it('derives shot size, angle + dutch, framing, lens, focus, and movement strings', () => {
    const derived = deriveShotSpecPromptStrings({
      shotSize: 'medium-close-up',
      subjectFraming: ['single', 'over-the-shoulder'],
      cameraAngle: 'eye-level',
      dutch: 'right',
      lens: {
        type: 'wide',
        millimeters: 28,
        focus: 'shallow-focus',
      },
      movement: {
        movement: 'tracking',
        directions: ['left', 'forward'],
        track: 'circular',
        rig: 'gimbal',
      },
      custom: { composition: 'tight on hands', movement: 'slow ramp' },
    });

    expect(derived.shotType).toBe('Medium Close-Up');
    expect(derived.cameraAngle).toBe('Eye-Level, Dutch right');
    expect(derived.framing).toBe('Single, Over Shoulder, tight on hands');
    expect(derived.lensIntent).toBe('Wide 28mm, Shallow Focus');
    expect(derived.cameraMovement).toBe(
      'Tracking, left/forward, circular track, on gimbal, slow ramp'
    );
  });

  it('keeps a custom movement even without a structured movement object', () => {
    const derived = deriveShotSpecPromptStrings({
      custom: { movement: 'handheld drift' },
    });
    expect(derived.cameraMovement).toBe('handheld drift');
  });
});
