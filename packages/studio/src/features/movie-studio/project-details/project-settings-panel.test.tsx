// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSettingsDocument } from '@gorenku/studio-core/client';
import {
  readProjectSettings,
  replaceProjectSettings,
} from '@/services/studio-projects-api';
import { ProjectSettingsPanel } from './project-settings-panel';

vi.mock('@/services/studio-projects-api', () => ({
  readProjectSettings: vi.fn(),
  replaceProjectSettings: vi.fn(),
}));

describe('ProjectSettingsPanel', () => {
  beforeEach(() => {
    vi.mocked(readProjectSettings).mockReset();
    vi.mocked(replaceProjectSettings).mockReset();
    vi.mocked(readProjectSettings).mockResolvedValue(resource(settings()));
    vi.mocked(replaceProjectSettings).mockImplementation(async (_name, value) => ({
      resource: resource(value),
      resourceKeys: ['project-settings'],
    }));
  });

  it('autosaves the complete latest document', async () => {
    render(
      <ProjectSettingsPanel
        projectName='constantinople'
        onSaveStatusChange={() => undefined}
      />
    );
    const control = await screen.findByRole('switch', { name: 'Analyze the screenplay' });
    fireEvent.click(control);
    await waitFor(
      () => expect(replaceProjectSettings).toHaveBeenCalledOnce(),
      { timeout: 2000 }
    );
    expect(replaceProjectSettings).toHaveBeenCalledWith(
      'constantinople',
      expect.objectContaining({
        version: 3,
        screenplayImport: expect.objectContaining({
          createContinuitySubjects: true,
          runScreenplayAnalysis: true,
          generateBeatStoryboardImages: false,
        }),
        generation: expect.any(Object),
      })
    );
  });

  it('does not overwrite a dirty draft during a resource refresh', async () => {
    render(
      <ProjectSettingsPanel
        projectName='constantinople'
        onSaveStatusChange={() => undefined}
      />
    );
    const control = await screen.findByRole('switch', { name: 'Analyze the screenplay' });
    fireEvent.click(control);
    const refreshed = settings();
    refreshed.screenplayImport.generateContinuityImages = true;
    vi.mocked(readProjectSettings).mockResolvedValue(resource(refreshed));
    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople',
            resourceKeys: ['project-settings'],
          },
        })
      );
    });

    await waitFor(() => expect(readProjectSettings).toHaveBeenCalledTimes(2));
    expect(control.getAttribute('data-state')).toBe('checked');
    expect(
      screen.getByRole('switch', { name: 'Generate profile and hero images' })
        .getAttribute('data-state')
    ).toBe('unchecked');
  });

  it('flushes a pending settings change when the panel unmounts', async () => {
    const view = render(
      <ProjectSettingsPanel
        projectName='constantinople'
        onSaveStatusChange={() => undefined}
      />
    );
    const control = await screen.findByRole('switch', {
      name: 'Analyze the screenplay',
    });
    fireEvent.click(control);

    view.unmount();

    await waitFor(() => expect(replaceProjectSettings).toHaveBeenCalledOnce());
    expect(replaceProjectSettings).toHaveBeenCalledWith(
      'constantinople',
      expect.objectContaining({
        screenplayImport: expect.objectContaining({
          runScreenplayAnalysis: true,
        }),
      })
    );
  });
});

function resource(value: ReturnType<typeof settings>) {
  return {
    project: { id: 'project_test', name: 'constantinople' },
    settings: value,
  };
}

function settings(): ProjectSettingsDocument {
  return {
    version: 3 as const,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      displayPreview: true,
      image: {
        provider: 'codex',
        askBeforeGenerating: false,
        runGenerationsConcurrently: true,
        maxConcurrentGenerations: 5,
      },
      video: {
        provider: 'fal-ai',
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 1,
      },
      audio: {
        provider: 'elevenlabs',
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 1,
      },
    },
  };
}
