// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VisualLanguageReport } from './visual-language-report';

describe('VisualLanguageReport', () => {
  it('renders shared Inspiration Analysis sections including Lineage', () => {
    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{ kind: 'inspiration', folderId: 'inspiration_folder_test0001' }}
        sections={{
          ...sharedSections(),
          inspiredBy: {
            description: 'Visual affinities, not confirmed influence.',
            items: [
              {
                category: 'cinematographer',
                name: 'Roger Deakins',
                confidence: 'medium',
                why: 'Restrained contrast and motivated light.',
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText('The thesis')).not.toBeNull();
    expect(screen.getByText('Palette')).not.toBeNull();
    expect(screen.getByText('Tone')).not.toBeNull();
    expect(screen.getByText('Frames')).not.toBeNull();
    expect(screen.getByText('Lighting')).not.toBeNull();
    expect(screen.getByText('Texture')).not.toBeNull();
    expect(screen.getByText('Inspired by')).not.toBeNull();
    expect(screen.getByText('Roger Deakins')).not.toBeNull();
  });

  it('renders nested Inspiration image references', () => {
    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{ kind: 'inspiration', folderId: 'inspiration_folder_test0001' }}
        sections={{
          ...sharedSections(),
          palette: {
            ...sharedSections().palette,
            observations: [
              {
                text: 'Warmth appears near labor.',
                imageFiles: ['palette-frame.png'],
              },
            ],
          },
          composition: {
            ...sharedSections().composition,
            patterns: [
              {
                name: 'Map pressure',
                description: 'Tables compress depth.',
                imageFiles: ['composition-frame.png'],
              },
            ],
          },
          inspiredBy: {
            description: 'Visual affinities, not confirmed influence.',
            items: [
              {
                category: 'cinematographer',
                name: 'Roger Deakins',
                confidence: 'medium',
                why: 'Restrained contrast and motivated light.',
                imageFiles: ['lineage-frame.png'],
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByAltText('palette-frame.png inspiration grab')).not.toBeNull();
    expect(screen.getByAltText('composition-frame.png inspiration grab')).not.toBeNull();
    expect(screen.getByAltText('lineage-frame.png inspiration grab')).not.toBeNull();
    expect(screen.queryByText('Palette frame')).toBeNull();

    fireEvent.click(screen.getByAltText('palette-frame.png inspiration grab'));
    expect(screen.getByRole('dialog', { name: 'Palette frame' })).not.toBeNull();
  });

  it('renders shared Lookbook sections including Camera', () => {
    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{
          kind: 'lookbook',
          imagesBySection: {
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
          },
        }}
        sections={{
          ...sharedSections(),
          camera: {
            description: 'Patient camera grammar.',
            movement: [{ name: 'Slow push', description: 'Push when decisions harden.' }],
            motion: [{ name: 'Held labor', description: 'Blocking moves with weight.' }],
            framing: [{ name: 'Measured distance', description: 'Close-ups are earned.' }],
          },
        }}
      />
    );

    expect(screen.getByText('Camera')).not.toBeNull();
    expect(screen.getByText('Movement')).not.toBeNull();
    expect(screen.getByText('Motion')).not.toBeNull();
    expect(screen.getByText('Framing')).not.toBeNull();
  });

  it('renders Storyboard Lookbook style widgets from section data', () => {
    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{
          kind: 'lookbook',
          imagesBySection: {
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
          },
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
            thesis: [],
            palette: [],
            toneMood: [],
            composition: [],
            lighting: [],
            texture: [],
            camera: [],
            styleBrief: [styleImage],
            lineAndFinish: [lineImage],
            valueAndAccent: [valueImage],
            guardrails: [guardrailImage],
          },
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

function storyboardImage(label: string, sections: string[]) {
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
          projectRelativePath: `visual-language/lookbook/${label}-board.png`,
          mimeType: 'image/png',
          sizeBytes: 123,
          contentHash: null,
          width: 1280,
          height: 720,
          durationSeconds: null,
        },
      ],
    },
  } as never;
}

function sharedSections() {
  return {
    thesis: {
      statement: 'The movie should feel rigorous and tense.',
      principles: ['Use negative space as pressure.'],
    },
    palette: {
      description: 'Steel, ash, and ember warmth.',
      colors: [{ hex: '#334455', name: 'Siege steel', meaning: 'Pressure.' }],
      observations: [{ text: 'Warmth appears near labor.' }],
    },
    toneMood: {
      tone: 'controlled dread',
      moodTags: ['tense'],
      description: 'Shadows hold detail.',
    },
    composition: {
      description: 'Orderly compositions tighten around decisions.',
      patterns: [{ name: 'Map pressure', description: 'Tables compress depth.' }],
    },
    lighting: {
      description: 'Practical pools of warm light.',
      patterns: [{ name: 'Lamp islands', description: 'Oil lamps isolate faces.' }],
    },
    texture: {
      description: 'Stone, smoke, and worn metal.',
      observations: [{ text: 'Fine surface texture stays visible.' }],
    },
  };
}
