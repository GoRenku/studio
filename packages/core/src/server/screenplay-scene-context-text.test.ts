import { describe, expect, it } from 'vitest';
import type { ScreenplayDocument } from '../client/screenplay.js';
import { renderScreenplaySceneContextText } from './screenplay-scene-context-text.js';

describe('screenplay Scene context text', () => {
  it('preserves block, attribution, extension, parenthetical, and line order', () => {
    const screenplay: ScreenplayDocument = {
      kind: 'screenplay',
      screenplay: { title: 'Test' },
      cast: [{ id: 'cast_mara', handle: 'mara', name: 'Mara', isVoiceOver: false }],
      locations: [],
      acts: [],
    };
    const scene = {
      id: 'scene_harbor',
      title: 'Harbor Quarter',
      setting: { interiorExterior: 'EXT', timeOfDay: 'EVENING' },
      blocks: [
        { type: 'action' as const, text: 'Mara enters the square.' },
        { type: 'dialogue' as const, dialogueId: 'dialogue_1', castMemberId: 'cast_mara', extension: 'O.S.', parenthetical: '(quietly)', lines: ['Keep moving.', 'Do not look back.'] },
        { type: 'transition' as const, text: 'CUT TO:' },
      ],
    };

    expect(renderScreenplaySceneContextText({ scene, screenplay })).toBe(
      'EXT — Harbor Quarter — EVENING\n\nMara enters the square.\n\nMara (O.S.)\n(quietly)\nKeep moving.\nDo not look back.\n\nCUT TO:'
    );
  });
});
