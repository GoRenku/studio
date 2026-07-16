import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import type { GenerationPurposeContract } from './purpose-contract.js';
import { estimateGeneration } from './estimates.js';

describe('generic generation estimates', () => {
  it('estimates pricing inputs without requiring execution inputs', async () => {
    const estimate = await estimateGeneration({
      spec: seedanceSpec({ duration: '5' }),
      purpose: videoPurpose,
    });

    expect(estimate.valid).toBe(true);
    if (estimate.valid) {
      expect(estimate.estimate.estimatedCostUsd).toBeCloseTo(1.512, 5);
      expect(estimate.estimate.billableUnits).toMatchObject({
        duration: '5',
        resolution: '720p',
        aspect_ratio: '16:9',
      });
    }
  });

  it('does not make the price approval depend on creative prompt contents', async () => {
    const first = await estimateGeneration({
      spec: seedanceSpec({ duration: '5', prompt: 'First opaque prompt.' }),
      purpose: videoPurpose,
    });
    const second = await estimateGeneration({
      spec: seedanceSpec({ duration: '5', prompt: 'Different opaque prompt.' }),
      purpose: videoPurpose,
    });

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    if (first.valid && second.valid) {
      expect(second.estimate.approvalToken).toBe(first.estimate.approvalToken);
    }
  });

  it('changes the price approval when a pricing input changes', async () => {
    const first = await estimateGeneration({
      spec: seedanceSpec({ duration: '5' }),
      purpose: videoPurpose,
    });
    const second = await estimateGeneration({
      spec: seedanceSpec({ duration: '6' }),
      purpose: videoPurpose,
    });

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    if (first.valid && second.valid) {
      expect(second.estimate.estimatedCostUsd).toBeGreaterThan(
        first.estimate.estimatedCostUsd
      );
      expect(second.estimate.approvalToken).not.toBe(
        first.estimate.approvalToken
      );
    }
  });
});

const videoPurpose = {
  purpose: 'image.create',
  targetKind: 'project',
  outputMediaKind: 'image',
} satisfies GenerationPurposeContract;

function seedanceSpec(values: Record<string, string>): GenerationSpec {
  return {
    purpose: 'image.create',
    target: { kind: 'project', id: 'project' },
    model: {
      provider: 'fal-ai',
      model: 'bytedance/seedance-2.0/image-to-video',
    },
    values: {
      resolution: '720p',
      aspect_ratio: '16:9',
      ...values,
    },
    references: [],
  };
}
