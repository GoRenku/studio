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

  it('combines resource keys from bulk dialogue-audio generation reports', () => {
    const report = generationResourceChangedReport(
      ['dialogue-audio', 'generate'],
      {
        generatedCount: 2,
        generated: [
          {
            context: {
              project: {
                name: 'dialogue-audio-test',
              },
            },
            resourceKeys: [
              'scene:scene_test0001',
              'scene-dialogue-audio:audio_a',
            ],
          },
          {
            context: {
              project: {
                name: 'dialogue-audio-test',
              },
            },
            resourceKeys: [
              'scene:scene_test0001',
              'scene-dialogue-audio:audio_b',
            ],
          },
        ],
      },
    );

    expect(report).toEqual({
      project: { name: 'dialogue-audio-test' },
      resourceKeys: [
        'scene:scene_test0001',
        'scene-dialogue-audio:audio_a',
        'scene-dialogue-audio:audio_b',
      ],
    });
  });
});
