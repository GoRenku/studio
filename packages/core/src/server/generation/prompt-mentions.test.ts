import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import {
  allocateGenerationReferencePromptMention,
  applyGenerationReferenceSlotSelection,
} from './references.js';
import { validateGenerationSpecEnvelope } from './spec-envelope.js';

describe('generation reference prompt mentions', () => {
  it('allocates monotonically, preserves same-placement replacement, and never scans prompt text', () => {
    const placement = { kind: 'slot' as const, sectionId: 'style', slotId: 'lookbook' };
    const spec = fixture();
    spec.values.prompt = 'Unknown @Reference99 remains opaque.';
    spec.references.push({
      placement,
      reference: { kind: 'asset-file', assetId: 'asset_a', assetFileId: 'file_a' },
    });

    const allocated = allocateGenerationReferencePromptMention({ spec, placement });
    expect(allocated.references[0]?.promptMention).toBe('@Reference1');
    expect(allocated.nextPromptMentionNumber).toBe(2);
    expect(allocated.values.prompt).toBe('Unknown @Reference99 remains opaque.');

    const replaced = applyGenerationReferenceSlotSelection(allocated, {
      placement,
      reference: { kind: 'asset-file', assetId: 'asset_b', assetFileId: 'file_b' },
    });
    expect(replaced.references[0]).toMatchObject({
      promptMention: '@Reference1',
      reference: { assetId: 'asset_b', assetFileId: 'file_b' },
    });

    const cleared = applyGenerationReferenceSlotSelection(replaced, {
      placement,
      reference: null,
    });
    const secondPlacement = {
      kind: 'slot' as const,
      sectionId: 'style',
      slotId: 'secondary',
    };
    const selectedAgain = applyGenerationReferenceSlotSelection(cleared, {
      placement: secondPlacement,
      reference: { kind: 'asset-file', assetId: 'asset_c', assetFileId: 'file_c' },
    });
    const allocatedAgain = allocateGenerationReferencePromptMention({
      spec: selectedAgain,
      placement: secondPlacement,
    });
    expect(allocatedAgain.references[0]?.promptMention).toBe('@Reference2');
    expect(allocatedAgain.nextPromptMentionNumber).toBe(3);
    expect(allocatedAgain.values.prompt).toBe('Unknown @Reference99 remains opaque.');
  });

  it('rejects duplicate, empty, and non-monotonic mention metadata before writes', () => {
    const spec = fixture();
    spec.nextPromptMentionNumber = 2;
    spec.references = [
      selection('one', '@Reference2'),
      selection('two', '@Reference2'),
      selection('three', '   '),
    ];

    const issues = validateGenerationSpecEnvelope({
      spec,
      purpose: { purpose: 'image.create', targetKind: 'project', outputMediaKind: 'image' },
    });
    expect(issues.filter((issue) => issue.code === 'CORE_GENERATION_SELECTION_INVALID')).toHaveLength(3);
  });
});

function fixture(): GenerationSpec {
  return {
    purpose: 'image.create',
    target: { kind: 'project', id: 'project' },
    executionKind: 'renku-managed',
    model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
    values: { prompt: 'Create an image.' },
    references: [],
  };
}

function selection(slotId: string, promptMention: string): GenerationSpec['references'][number] {
  return {
    placement: { kind: 'slot', sectionId: 'style', slotId },
    promptMention,
    reference: { kind: 'asset-file', assetId: `asset_${slotId}`, assetFileId: `file_${slotId}` },
  };
}
