// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectSettingsDocument } from '@gorenku/studio-core/client';
import { ProjectSettingsFields } from './project-settings-fields';

describe('ProjectSettingsFields', () => {
  it('renders the accepted generation sections, provider choices, and defaults', () => {
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Image Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Video Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Audio Generation' })).toBeTruthy();
    expect(screen.getByText('GPT Image 2 (Codex)')).toBeTruthy();
    expect(screen.getByText('ElevenLabs')).toBeTruthy();
    expect(screen.queryByText('Replicate')).toBeNull();
    expect(screen.queryByText('WaveSpeed')).toBeNull();
    expect(screen.queryByText('World Labs')).toBeNull();
  });

  it('retains the configured maximum when concurrency is switched off', () => {
    const onChange = vi.fn();
    const value = settings();
    value.generation.video.runGenerationsConcurrently = true;
    value.generation.video.maxConcurrentGenerations = 3;
    render(<ProjectSettingsFields settings={value} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('switch', { name: 'Run Generations Concurrently' })[1]!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      generation: expect.objectContaining({
        video: expect.objectContaining({ runGenerationsConcurrently: false, maxConcurrentGenerations: 3 }),
      }),
    }));
  });
});

function settings(): ProjectSettingsDocument {
  return {
    version: 3,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      displayPreview: true,
      image: { provider: 'codex', askBeforeGenerating: false, runGenerationsConcurrently: true, maxConcurrentGenerations: 5 },
      video: { provider: 'fal-ai', askBeforeGenerating: true, runGenerationsConcurrently: false, maxConcurrentGenerations: 1 },
      audio: { provider: 'elevenlabs', askBeforeGenerating: true, runGenerationsConcurrently: false, maxConcurrentGenerations: 1 },
    },
  };
}
