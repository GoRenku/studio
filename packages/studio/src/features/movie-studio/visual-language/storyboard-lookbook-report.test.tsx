// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  LookbookImage,
  ProjectRelativePath,
  StoryboardLookbookSection,
} from '@gorenku/studio-core/client';
import { VisualLanguageReport } from './visual-language-report';

describe('Storyboard Lookbook report', () => {
  it('renders Storyboard Lookbook style widgets from section data', () => {
    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{
          kind: 'lookbook',
          imagesBySection: emptyLookbookImagesBySection(),
          imagesByPoint: {},
        }}
        sections={{
          styleBrief: {
            text: 'Hand-drawn graphite boards on warm paper.',
            styleKind: 'graphite hand-drawn',
            palette: [
              { hex: '#ede7d6', name: 'Paper', meaning: 'Warm off-white substrate.' },
            ],
            tags: ['1452 siege', 'tactile'],
          },
          lineAndFinish: {
            text: 'Confident contour with lighter construction marks.',
            marks: [
              { label: 'contour', thickness: 5 },
              { label: 'guide', thickness: 1 },
            ],
          },
          valueAndAccent: {
            text: 'Five-step value range, high contrast.',
            valueSteps: ['#ede7d6', '#807c73', '#232220'],
            contrast: 'high',
          },
          guardrails: {
            text: 'Avoid anything that weakens readable staging.',
            forbidden: ['fantasy spectacle'],
            favored: ['grounded siege imagery'],
          },
        }}
      />
    );

    expect(screen.getByText('Style brief')).not.toBeNull();
    expect(screen.getByText('Line and finish')).not.toBeNull();
    expect(screen.getByText('Value and accent')).not.toBeNull();
    expect(screen.getByText('Guardrails')).not.toBeNull();
    expect(screen.getByText('graphite hand-drawn')).not.toBeNull();
    expect(screen.getByText('Paper')).not.toBeNull();
    expect(screen.getByText('1452 siege')).not.toBeNull();
    expect(screen.getByText('contour')).not.toBeNull();
    expect(screen.getByText('fantasy spectacle')).not.toBeNull();
    expect(screen.getByText('grounded siege imagery')).not.toBeNull();
  });

  it('renders each Storyboard Lookbook image in its tagged section', () => {
    const styleImage = storyboardImage('style', ['styleBrief']);
    const lineImage = storyboardImage('line', ['lineAndFinish']);
    const valueImage = storyboardImage('value', ['valueAndAccent']);
    const guardrailImage = storyboardImage('guardrail', ['guardrails']);

    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{
          kind: 'lookbook',
          imagesBySection: {
            ...emptyLookbookImagesBySection(),
            styleBrief: [styleImage],
            lineAndFinish: [lineImage],
            valueAndAccent: [valueImage],
            guardrails: [guardrailImage],
          },
          imagesByPoint: {},
        }}
        sections={{
          styleBrief: { text: 'Graphite boards.' },
          lineAndFinish: { text: 'Confident contour.' },
          valueAndAccent: { text: 'High contrast values.' },
          guardrails: { text: 'Avoid photoreal stills.' },
        }}
      />
    );

    expect(screen.getByAltText('Style board')).not.toBeNull();
    expect(screen.getByAltText('Line board')).not.toBeNull();
    expect(screen.getByAltText('Value board')).not.toBeNull();
    expect(screen.getByAltText('Guardrail board')).not.toBeNull();
  });
});

function emptyLookbookImagesBySection() {
  return {
    thesis: [],
    palette: [],
    toneMood: [],
    composition: [],
    lighting: [],
    texture: [],
    camera: [],
    styleBrief: [],
    lineAndFinish: [],
    valueAndAccent: [],
    guardrails: [],
  };
}

function storyboardImage(
  label: string,
  sections: StoryboardLookbookSection[]
): LookbookImage {
  const title = `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} board`;
  return {
    id: `lookbook_image_${label}`,
    lookbookId: 'lookbook_test0001',
    lookbookType: 'storyboard',
    sections,
    asset: {
      assetId: `asset_${label}`,
      type: 'lookbook_image',
      mediaKind: 'image',
      title,
      oneLineSummary: 'A storyboard frame.',
      origin: 'generated',
      availability: 'available',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
      files: [
        {
          id: `asset_file_${label}`,
          role: 'primary',
          mediaKind: 'image',
          projectRelativePath:
            `visual-language/lookbook/${label}-board.png` as ProjectRelativePath,
          mimeType: 'image/png',
          sizeBytes: 123,
          contentHash: null,
          width: 1280,
          height: 720,
          durationSeconds: null,
        },
      ],
    },
  };
}
