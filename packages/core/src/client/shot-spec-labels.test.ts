import { describe, expect, it } from 'vitest';
import { deriveTakeShotDesignPromptStrings } from './shot-spec-labels.js';

describe('deriveTakeShotDesignPromptStrings', () => {
  it('returns no strings for empty or absent design', () => {
    expect(deriveTakeShotDesignPromptStrings(undefined)).toEqual({});
    expect(deriveTakeShotDesignPromptStrings({})).toEqual({
      shotType: undefined,
      cameraAngle: undefined,
      framing: undefined,
      lensIntent: undefined,
      cameraMovement: undefined,
    });
  });

  it('derives shot size, angle + dutch, framing, lens, focus, and movement strings', () => {
    const derived = deriveTakeShotDesignPromptStrings({
      composition: {
        shotSize: 'medium-close-up',
        subjectFraming: ['single', 'over-the-shoulder'],
        cameraAngle: 'eye-level',
        dutch: 'right',
        lens: {
          type: 'wide',
          millimeters: 28,
          focus: 'shallow-focus',
        },
        customComposition: 'tight on hands',
      },
      motion: {
        movement: 'tracking',
        directions: ['left', 'forward'],
        track: 'circular',
        rig: 'gimbal',
        customMotion: 'slow ramp',
      },
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
    const derived = deriveTakeShotDesignPromptStrings({
      motion: { customMotion: 'handheld drift' },
    });
    expect(derived.cameraMovement).toBe('handheld drift');
  });

  it('derives the establishing shot label from structured shot size design', () => {
    const derived = deriveTakeShotDesignPromptStrings({
      composition: { shotSize: 'establishing-shot' },
    });

    expect(derived.shotType).toBe('Establishing Shot');
  });
});
