import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import { preparePurposeExecutionSpec } from './purpose-execution.js';
import { readGenerationPurpose } from './purposes.js';

describe('generation purpose execution', () => {
  it('uses a model-supported canvas with complete Project-ratio storyboard panels', async () => {
    const spec: GenerationSpec = {
      executionKind: 'renku-managed',
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: 'scene-1' },
      model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
      values: { prompt: 'Illustrate the selected Beats.' },
      references: [],
    };

    const prepared = await preparePurposeExecutionSpec({
      spec,
      purpose: readGenerationPurpose(spec.purpose),
      projectAspectRatio: '16:9',
    });

    expect(prepared.values).toMatchObject({
      quality: 'high',
      prompt: expect.stringContaining(
        'Arrange one to four complete 16:9 storyboard panels in Beat order in a clean grid'
      ),
    });
    expect(prepared.values.prompt).not.toContain('4:3');
    expect(prepared.values.prompt).not.toContain('2x2');
  });

  it('preserves agent-external requests exactly for agent-owned execution', async () => {
    const spec: GenerationSpec = {
      executionKind: 'agent-external',
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: 'scene-1' },
      model: { provider: 'codex', model: 'gpt-image-2' },
      values: { prompt: 'Exact reviewed Codex prompt.' },
      references: [],
    };

    await expect(preparePurposeExecutionSpec({
      spec,
      purpose: readGenerationPurpose(spec.purpose),
      projectAspectRatio: '16:9',
    })).resolves.toEqual(spec);
  });
});
