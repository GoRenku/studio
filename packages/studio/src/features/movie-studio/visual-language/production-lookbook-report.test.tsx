// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  LookbookImage,
  ProjectRelativePath,
} from '@gorenku/studio-core/client';
import { VisualLanguageReport } from './visual-language-report';

describe('Production Lookbook report', () => {
  it('renders shared Inspiration Analysis sections including Lineage', () => {
    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{ kind: 'inspiration', folderId: 'inspiration_folder_test0001' }}
        sections={{
          ...sharedMovieSections(),
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
    const sections = sharedMovieSections();

    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{ kind: 'inspiration', folderId: 'inspiration_folder_test0001' }}
        sections={{
          ...sections,
          palette: {
            ...sections.palette,
            observations: [
              {
                text: 'Warmth appears near labor.',
                imageFiles: ['palette-frame.png'],
              },
            ],
          },
          composition: {
            ...sections.composition,
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

  it('renders shared Production Lookbook sections including Camera', () => {
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
          imagesByPoint: {},
        }}
        sections={{
          ...sharedMovieSections(),
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

  it('renders Production Lookbook images anchored to a specific point', () => {
    const sections = sharedMovieSections();

    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{
          kind: 'lookbook',
          imagesBySection: emptyImagesBySection(),
          imagesByPoint: {
            'comp-map-pressure': [lookbookImage('Composition board')],
          },
        }}
        sections={{
          ...sections,
          composition: {
            description: sections.composition.description,
            patterns: [
              {
                id: 'comp-map-pressure',
                name: 'Map pressure',
                description: 'Tables compress depth.',
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByAltText('Composition board')).not.toBeNull();
  });

  it('renders Production Lookbook thesis section images under the thesis', () => {
    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{
          kind: 'lookbook',
          imagesBySection: {
            ...emptyImagesBySection(),
            thesis: [lookbookImage('Urban s cannon drawing')],
          },
          imagesByPoint: {},
        }}
        sections={sharedMovieSections()}
      />
    );

    expect(screen.getByAltText('Urban s cannon drawing')).not.toBeNull();
  });

  it('uses adaptive layouts for point evidence image counts', () => {
    const sections = sharedMovieSections();

    render(
      <VisualLanguageReport
        projectName='constantinople'
        source={{
          kind: 'lookbook',
          imagesBySection: emptyImagesBySection(),
          imagesByPoint: {
            'comp-single': [lookbookImage('Single board', 'single')],
            'comp-grid': [
              lookbookImage('Grid board 1', 'grid-1'),
              lookbookImage('Grid board 2', 'grid-2'),
              lookbookImage('Grid board 3', 'grid-3'),
            ],
            'comp-dense': Array.from({ length: 6 }, (_, index) =>
              lookbookImage(`Dense board ${index + 1}`, `dense-${index + 1}`)
            ),
          },
        }}
        sections={{
          ...sections,
          composition: {
            description: sections.composition.description,
            patterns: [
              {
                id: 'comp-single',
                name: 'Single pressure',
                description: 'One image carries the full point.',
              },
              {
                id: 'comp-grid',
                name: 'Grid pressure',
                description: 'A few images compare variations.',
              },
              {
                id: 'comp-dense',
                name: 'Dense pressure',
                description: 'Many images need a wide grid.',
              },
            ],
          },
        }}
      />
    );

    expect(
      screen
        .getByText('Single pressure')
        .closest('[data-lookbook-evidence-layout]')
        ?.getAttribute('data-lookbook-evidence-layout')
    ).toBe('single');
    expect(
      screen
        .getByText('Grid pressure')
        .closest('[data-lookbook-evidence-layout]')
        ?.getAttribute('data-lookbook-evidence-layout')
    ).toBe('grid');
    expect(
      screen
        .getByText('Dense pressure')
        .closest('[data-lookbook-evidence-layout]')
        ?.getAttribute('data-lookbook-evidence-layout')
    ).toBe('dense');
  });
});

function sharedMovieSections() {
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

function emptyImagesBySection() {
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

function lookbookImage(title: string, id: string = 'comp'): LookbookImage {
  return {
    id: `lookbook_image_${id}`,
    lookbookId: 'lookbook_test0001',
    lookbookKind: 'production',
    sections: [],
    points: ['comp-map-pressure'],
    asset: {
      assetId: `asset_${id}`,
      type: 'lookbook_image',
      mediaKind: 'image',
      title,
      oneLineSummary: 'A movie lookbook frame.',
      origin: 'generated',
      availability: 'available',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z',
      files: [
        {
          id: `asset_file_${id}`,
          role: 'primary',
          mediaKind: 'image',
          projectRelativePath:
            'visual-language/lookbook/comp-board.png' as ProjectRelativePath,
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
