import { describe, expect, it } from 'vitest';
import {
  emptySceneShotVideoTakeState,
  updateSceneShotVideoTakeShotDesign,
} from './take-state.js';

describe('scene shot video take state', () => {
  it('removes cleared optional custom shot design text before persistence', () => {
    const state = updateSceneShotVideoTakeShotDesign({
      state: emptySceneShotVideoTakeState(),
      shotId: 'shot_001',
      shotDesign: {
        composition: {
          shotSize: 'wide-shot',
          customComposition: '',
        },
        motion: {
          movement: 'push-in',
          customMotion: '   ',
        },
      },
    });

    expect(state.shotDesignByShotId.shot_001).toEqual({
      composition: { shotSize: 'wide-shot' },
      motion: { movement: 'push-in' },
    });
  });

  it('removes the shot design entry when cleared custom text leaves no choices', () => {
    const state = updateSceneShotVideoTakeShotDesign({
      state: emptySceneShotVideoTakeState(),
      shotId: 'shot_001',
      shotDesign: {
        composition: { customComposition: '' },
        motion: { customMotion: '   ' },
      },
    });

    expect(state.shotDesignByShotId.shot_001).toBeUndefined();
  });
});
