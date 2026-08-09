import { describe, expect, it } from 'vitest';
import type { Screenplay } from '../client/screenplay/index.js';
import { renderScreenplaySceneContextText } from './screenplay/context/scene-text.js';

describe('Screenplay Scene context text', () => {
  it('preserves heading, block, attribution, extension, parenthetical, speech, and dual-dialogue order', () => {
    const screenplay: Screenplay = {
      opening: [],
      scenes: [{
        id: 'scene_harbor',
        productionNumber: '1',
        heading: 'EXT. HARBOR QUARTER - EVENING',
        title: 'Harbor Quarter',
        blocks: [
          { id: 'block_action', type: 'action', text: 'Mara enters the square.' },
          {
            id: 'turn_mara',
            type: 'dialogue',
            characterName: 'MARA',
            extensions: ['O.S.'],
            parts: [
              { id: 'part_direction', type: 'parenthetical', text: 'quietly' },
              { id: 'part_speech_1', type: 'speech', text: 'Keep moving.' },
              { id: 'part_speech_2', type: 'speech', text: 'Do not look back.' },
            ],
          },
          {
            id: 'block_dual',
            type: 'dualDialogue',
            left: {
              id: 'turn_left',
              characterName: 'URBAN',
              extensions: [],
              parts: [{ id: 'part_left', type: 'speech', text: 'Wait.' }],
            },
            right: {
              id: 'turn_right',
              characterName: 'MARA',
              extensions: ['V.O.'],
              parts: [{ id: 'part_right', type: 'speech', text: 'No.' }],
            },
          },
          { id: 'block_transition', type: 'transition', text: 'CUT TO:' },
        ],
      }],
      sections: [],
      structure: [{
        id: 'entry_scene',
        content: { type: 'scene', sceneId: 'scene_harbor' },
        position: 0,
      }],
      references: [],
    };

    expect(renderScreenplaySceneContextText({
      scene: screenplay.scenes[0]!,
      screenplay,
    })).toBe(
      'EXT. HARBOR QUARTER - EVENING\n\nMara enters the square.\n\nMARA (O.S.)\n(quietly)\nKeep moving.\nDo not look back.\n\nURBAN\nWait.\n\nMARA (V.O.)\nNo.\n\nCUT TO:',
    );
  });
});
