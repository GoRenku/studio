import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import { applyGenerationSpecReferenceChanges } from './spec-reference-edits.js';

const placement = {
  kind: 'slot' as const,
  sectionId: 'cast',
  slotId: 'character-sheet',
  subject: { kind: 'castMember', id: 'cast-1' },
};

describe('Generation Preview reference edits', () => {
  it('replaces one slot without changing additional references', () => {
    const result = applyGenerationSpecReferenceChanges({
      spec: spec(),
      changes: [{
        kind: 'replace', placement,
        reference: { kind: 'asset-file', assetId: 'asset-new', assetFileId: 'file-new' },
      }],
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
    const cleared = applyGenerationSpecReferenceChanges({
      spec: spec(), changes: [{ kind: 'clear', placement }],
    });
    expect(cleared.references).toHaveLength(1);
    const selected = applyGenerationSpecReferenceChanges({
      spec: { ...spec(), references: [] },
      changes: [{
        kind: 'replace', placement,
        reference: { kind: 'asset-file', assetId: 'asset-new', assetFileId: 'file-new' },
      }],
    });
    expect(selected.references).toHaveLength(1);
  });
});

function spec(): GenerationSpec {
  return {
    purpose: 'cast.character-sheet',
    target: { kind: 'castMember', id: 'cast-1' },
    values: {},
    references: [
      {
        id: 'old', placement, included: true,
        reference: { kind: 'asset-file', assetId: 'asset-old', assetFileId: 'file-old' },
      },
      {
        id: 'additional', placement: { kind: 'additional' }, included: true,
        reference: { kind: 'project-file', projectRelativePath: 'research/extra.png' as never },
      },
    ],
  };
}
