// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSettingsDocument } from '@gorenku/studio-core/client';
import {
  readProjectSettings,
  replaceProjectSettings,
} from '@/services/studio-projects-api';
import { readProviderCredentials, updateProviderCredentials } from '@/services/studio-provider-credentials-api';
import { ProjectSettingsPanel } from './project-settings-panel';

vi.mock('@/services/studio-projects-api', () => ({
  readProjectSettings: vi.fn(),
  replaceProjectSettings: vi.fn(),
}));
vi.mock('@/services/studio-provider-credentials-api', () => ({
  readProviderCredentials: vi.fn(),
  updateProviderCredentials: vi.fn(),
}));

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('ProjectSettingsPanel', () => {
  beforeEach(() => {
    vi.mocked(readProjectSettings).mockReset();
    vi.mocked(replaceProjectSettings).mockReset();
    vi.mocked(readProviderCredentials).mockReset();
    vi.mocked(updateProviderCredentials).mockReset();
    vi.mocked(readProviderCredentials).mockResolvedValue({ providers: [
      { provider: 'fal-ai', label: 'Fal.ai', configured: true },
      { provider: 'elevenlabs', label: 'ElevenLabs', configured: true },
    ] });
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
        version: 6,
        screenplayImport: expect.objectContaining({
          createContinuitySubjects: true,
          runScreenplayAnalysis: true,
          generateBeatStoryboardImages: false,
        }),
        generation: expect.any(Object),
      })
    );
  });

  it('refreshes key status when a provider menu opens without saving the Project', async () => {
    render(
      <ProjectSettingsPanel
        projectName='constantinople'
        onSaveStatusChange={() => undefined}
      />
    );
    await waitFor(() => expect(readProviderCredentials).toHaveBeenCalledOnce());
    vi.mocked(readProviderCredentials).mockResolvedValue({ providers: [
      { provider: 'fal-ai', label: 'Fal.ai', configured: true },
      { provider: 'replicate', label: 'Replicate', configured: true },
      { provider: 'elevenlabs', label: 'ElevenLabs', configured: true },
    ] });
    const providerSelects = await screen.findAllByRole('combobox', { name: 'Provider' });
    fireEvent.click(providerSelects[1]!);
    await waitFor(() => expect(readProviderCredentials).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('option', { name: 'Replicate' })).toBeTruthy();
    expect(replaceProjectSettings).not.toHaveBeenCalled();
  });

  it('keeps autosaving pending edits while API key setup is open and returns focus on Cancel', async () => {
    vi.mocked(readProviderCredentials).mockResolvedValue({ providers: [
      { provider: 'fal-ai', label: 'Fal.ai', configured: false },
    ] });
    render(<ProjectSettingsPanel projectName='constantinople' onSaveStatusChange={() => undefined} />);
    const control = await screen.findByRole('switch', { name: 'Analyze the screenplay' });
    const setup = screen.getByRole('button', { name: 'Add API keys' });
    const route = window.location.href;
    fireEvent.click(screen.getByRole('button', { name: 'Image Generation' }));
    fireEvent.click(control);
    setup.focus();
    fireEvent.click(setup);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(window.location.href).toBe(route);
    await waitFor(() => expect(replaceProjectSettings).toHaveBeenCalledWith(
      'constantinople', expect.objectContaining({
        screenplayImport: expect.objectContaining({ runScreenplayAnalysis: true }),
      })
    ), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Image Generation' })));
    expect(control.getAttribute('data-state')).toBe('checked');
  });

  it('refreshes choices after adding a key without changing the saved provider defaults', async () => {
    const empty = { providers: [
      { provider: 'fal-ai', label: 'Fal.ai', configured: false },
      { provider: 'elevenlabs', label: 'ElevenLabs', configured: false },
    ] };
    const configured = { providers: empty.providers.map((provider) => ({ ...provider, configured: true })) };
    vi.mocked(readProviderCredentials).mockResolvedValue(empty);
    vi.mocked(updateProviderCredentials).mockResolvedValue(configured);
    render(<ProjectSettingsPanel projectName='constantinople' onSaveStatusChange={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add API keys' }));
    fireEvent.change(await screen.findByLabelText('Fal.ai'), { target: { value: 'test-key' } });
    vi.mocked(readProviderCredentials).mockResolvedValue(configured);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Provider API key setup' })).toBeNull());
    const selects = screen.getAllByRole('combobox', { name: 'Provider' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Image Generation' })));
    expect(selects[1]).toHaveProperty('disabled', false);
    expect(selects[1]!.textContent).toContain('Fal.ai');
    expect(selects[2]!.textContent).toContain('ElevenLabs');
    expect(replaceProjectSettings).not.toHaveBeenCalled();
  });

  it('reports a key-status failure while leaving other Project settings editable', async () => {
    vi.mocked(readProviderCredentials).mockRejectedValue(new Error('Could not read saved API keys.'));
    render(
      <ProjectSettingsPanel
        projectName='constantinople'
        onSaveStatusChange={() => undefined}
      />
    );
    expect(await screen.findAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('switch', { name: 'Analyze the screenplay' })).toBeTruthy();
    const providerSelects = screen.getAllByRole('combobox', { name: 'Provider' });
    expect(providerSelects[0]!.hasAttribute('disabled')).toBe(false);
    expect(providerSelects[1]!.hasAttribute('disabled')).toBe(true);
    fireEvent.click(providerSelects[0]!);
    expect(screen.getByRole('option', { name: 'ChatGPT Images 2.5 (Codex)' })).toBeTruthy();
    await waitFor(() => expect(readProviderCredentials).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(replaceProjectSettings).not.toHaveBeenCalled();
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
    version: 6 as const,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      displayPreview: true,
      enableProviderPromptExpansion: true,
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
