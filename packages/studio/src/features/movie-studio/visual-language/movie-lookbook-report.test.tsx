// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VisualLanguageReport } from './visual-language-report';

describe('Movie Lookbook report', () => {
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

  it('renders shared Movie Lookbook sections including Camera', () => {
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
