import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import {
  applyGenerationGenericReferences,
  applyGenerationReferenceSlotSelection,
} from './references.js';

const placement = {
  kind: 'slot' as const,
  sectionId: 'cast',
  slotId: 'character-sheet',
  subject: { kind: 'castMember', id: 'cast-1' },
};

describe('Generation Preview reference edits', () => {
  it('replaces one slot without changing additional references', () => {
    const result = applyGenerationReferenceSlotSelection(spec(), {
        placement,
        reference: { kind: 'asset-file', assetId: 'asset-new', assetFileId: 'file-new' },
    });
    expect(result.references).toEqual(expect.arrayContaining([
      expect.objectContaining({
        placement,
        reference: { kind: 'asset-file', assetId: 'asset-new', assetFileId: 'file-new' },
      }),
      expect.objectContaining({ placement: { kind: 'additional' } }),
    ]));
    expect(result.references.some((reference) =>
      reference.reference.kind === 'asset-file' && reference.reference.assetId === 'asset-old'
    )).toBe(false);
  });

  it('clears a slot and permits selecting from an empty slot', () => {
    const cleared = applyGenerationReferenceSlotSelection(spec(), { placement, reference: null });
    expect(cleared.references).toHaveLength(1);
    const selected = applyGenerationReferenceSlotSelection(
      { ...spec(), references: [] }, {
        placement,
        reference: { kind: 'asset-file', assetId: 'asset-new', assetFileId: 'file-new' },
      });
    expect(selected.references).toHaveLength(1);
  });

  it('replaces the ordered generic collection without changing typed slots', () => {
    const result = applyGenerationGenericReferences(spec(), [
      { kind: 'asset-file', assetId: 'asset-video', assetFileId: 'file-video' },
      { kind: 'asset-file', assetId: 'asset-audio', assetFileId: 'file-audio' },
    ]);

    expect(result.references[0]).toEqual(spec().references[0]);
    expect(result.references.slice(1).map((selection) => selection.reference)).toEqual([
      { kind: 'asset-file', assetId: 'asset-video', assetFileId: 'file-video' },
      { kind: 'asset-file', assetId: 'asset-audio', assetFileId: 'file-audio' },
    ]);
  });
});

function spec(): GenerationSpec {
  return {
    purpose: 'cast.character-sheet',
    target: { kind: 'castMember', id: 'cast-1' },
    values: {},
    references: [
      {
        id: 'old', placement,
        reference: { kind: 'asset-file', assetId: 'asset-old', assetFileId: 'file-old' },
      },
      {
        id: 'additional', placement: { kind: 'additional' },
        reference: { kind: 'project-file', projectRelativePath: 'research/extra.png' as never },
      },
    ],
  };
}
