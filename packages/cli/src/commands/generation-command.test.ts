import { describe, expect, it } from 'vitest';
import { generationResourceChangedReport } from './generation-command.js';

describe('generationResourceChangedReport', () => {
  it('reads dialogue-audio mutation project identity from the returned context', () => {
    const report = generationResourceChangedReport(
      ['dialogue-audio', 'generate'],
      {
        context: {
          project: {
            name: 'dialogue-audio-test',
            baseLanguageCode: 'en',
          },
        },
        resourceKeys: [
          'scene:scene_test0001',
          'surface:scene:scene_test0001:dialogue-audio',
        ],
      },
    );

    expect(report).toEqual({
      project: { name: 'dialogue-audio-test', baseLanguageCode: 'en' },
      resourceKeys: [
        'scene:scene_test0001',
        'surface:scene:scene_test0001:dialogue-audio',
      ],
    });
  });

});
