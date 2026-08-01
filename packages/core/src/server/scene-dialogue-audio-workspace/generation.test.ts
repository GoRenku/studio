import { describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';

describe('Scene Dialogue Audio generation', () => {
  it('estimates from model and text without a project, setup, or Cast Voice', async () => {
    const text = 'The barrel is still angry.';
    const report = await createProjectDataService().estimateSceneDialogueAudioDraft({
      estimate: {
        modelChoice: 'elevenlabs/eleven_v3',
        text,
      },
    });

    expect(report).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_v3',
      billableUnits: { characterCount: text.length },
    });
    expect(report.estimatedCostUsd).toBeGreaterThan(0);
  });
});
