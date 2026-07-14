import { describe, expect, it } from 'vitest';
import type { StoryboardLookbookDocument } from './validator.js';
import {
  parseStoredLookbookDefinition,
  serializeLookbookDocument,
} from './validator.js';

function storyboardDocument(): StoryboardLookbookDocument {
  return {
    kind: 'storyboardLookbook',
    storyboardLookbook: {
      name: 'Sepia Graphite Siege Boards',
      styleBrief: {
        text: 'Hand-drawn graphite boards on warm paper.',
        styleKind: 'graphite hand-drawn',
        palette: [
          { hex: '#ede7d6', name: 'Paper', meaning: 'Warm off-white substrate.' },
          { hex: '#2b2a28', name: 'Line', meaning: 'Graphite contour.' },
        ],
        tags: ['1452 siege', 'tactile'],
      },
      lineAndFinish: {
        text: 'Confident contour with lighter construction marks.',
        marks: [
          { label: 'contour', thickness: 5 },
          { label: 'guide', thickness: 1 },
        ],
        hatching: 'Sparse cross-hatch in shadow only.',
      },
      valueAndAccent: {
        text: 'Five-step value range, high contrast.',
        valueSteps: ['#ede7d6', '#807c73', '#232220'],
        contrast: 'high',
        accents: [
          { hex: '#a8763c', name: 'Bronze', meaning: 'Metal and fire only.' },
        ],
      },
      guardrails: {
        text: 'Avoid anything that weakens readable staging.',
        forbidden: ['fantasy spectacle', 'photorealism'],
        favored: ['grounded siege imagery'],
      },
    },
    sourceInspirationFolderIds: [],
  };
}

describe('storyboard Lookbook validator', () => {
  it('accepts and round-trips the optional style fields', () => {
    const serialized = serializeLookbookDocument({ document: storyboardDocument() });
    expect(serialized.kind).toBe('storyboard');
    const definition = parseStoredLookbookDefinition({
      kind: 'storyboard',
      value: serialized.definitionJson,
    });
    expect(definition.styleBrief.styleKind).toBe('graphite hand-drawn');
    expect(definition.styleBrief.palette).toHaveLength(2);
    expect(definition.valueAndAccent.valueSteps).toEqual([
      '#ede7d6',
      '#807c73',
      '#232220',
    ]);
    expect(definition.guardrails.forbidden).toContain('photorealism');
  });
});
