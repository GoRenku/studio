// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DefaultModelListResource, ProjectSettingsDocument, ProviderCredentialStatus } from '@gorenku/studio-core/client';
import { ProjectSettingsFields } from './project-settings-fields';

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('ProjectSettingsFields', () => {
  it('shows keyed general providers, Audio-only ElevenLabs, and Image-only Codex', () => {
    const onRefreshProviders = vi.fn();
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} providers={providers()} providersLoading={false} onRefreshProviders={onRefreshProviders} defaultModels={null} />);
    expect(screen.getByRole('button', { name: 'Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Image Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Video Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Audio Generation' })).toBeTruthy();
    expect(screen.getByText('Codex (built-in)')).toBeTruthy();
    expect(screen.getByText('ElevenLabs')).toBeTruthy();
    expect((screen.getByRole('switch', {
      name: 'Enable prompt expansion at the provider level when available for a model',
    }) as HTMLButtonElement).getAttribute('data-state')).toBe('checked');
    const providerSelects = screen.getAllByRole('combobox', { name: 'Provider' });
    fireEvent.click(providerSelects[0]!);
    expect(screen.getByRole('option', { name: 'Codex (built-in)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Fal.ai' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Replicate' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'ElevenLabs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'World Labs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Pika' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(providerSelects[2]!);
    expect(screen.getByRole('option', { name: 'Fal.ai' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Replicate' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'ElevenLabs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'World Labs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Codex (built-in)' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(providerSelects[3]!);
    expect(screen.getByRole('option', { name: 'Fal.ai' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Replicate' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'ElevenLabs' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'World Labs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Pika' })).toBeNull();
    expect(onRefreshProviders).toHaveBeenCalledTimes(3);
  });

  it('keeps an unkeyed saved provider without offering it as a choice', () => {
    const value = settings();
    value.generation.audio.provider = 'pika';
    render(<ProjectSettingsFields settings={value} onChange={() => undefined} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={null} />);
    expect(screen.getByText('Pika (API key missing)')).toBeTruthy();
    expect(screen.getByText('This provider has no saved API key.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Provider' })[3]!);
    expect(screen.queryByRole('option', { name: 'Pika' })).toBeNull();
  });

  it('keeps a keyed special provider saved in the wrong media setting without claiming its key is missing', () => {
    const value = settings();
    value.generation.image.provider = 'elevenlabs';
    value.generation.video.provider = 'world-labs';
    render(<ProjectSettingsFields settings={value} onChange={() => undefined} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={null} />);
    expect(screen.getByText('ElevenLabs (unavailable here)')).toBeTruthy();
    expect(screen.getByText('World Labs (unavailable here)')).toBeTruthy();
    expect(screen.getAllByText('This provider is not available for this setting.')).toHaveLength(2);
    expect(screen.queryByText('This provider has no saved API key.')).toBeNull();
  });

  it('leaves Video unavailable when ElevenLabs is the only configured provider', () => {
    const keyedAudio = providers().map((provider) => ({ ...provider, configured: provider.provider === 'elevenlabs' }));
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} providers={keyedAudio} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={null} />);
    const providerSelects = screen.getAllByRole('combobox', { name: 'Provider' });
    expect(providerSelects[2]).toHaveProperty('disabled', true);
    expect(providerSelects[3]).toHaveProperty('disabled', false);
    expect(screen.getByText('No providers available')).toBeTruthy();
    expect(screen.queryByText('No API keys added')).toBeNull();
  });

  it('shows no external choices without saved keys while keeping Codex', () => {
    const onChange = vi.fn();
    render(<ProjectSettingsFields settings={settings()} onChange={onChange} providers={providers().map((provider) => ({ ...provider, configured: false }))} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={null} />);
    expect(screen.getByRole('region', { name: 'Provider API key setup' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add API keys' })).toHaveLength(1);
    expect(screen.getAllByText('No API keys added')).toHaveLength(2);
    const providerSelects = screen.getAllByRole('combobox', { name: 'Provider' });
    expect(providerSelects[2]).toHaveProperty('disabled', true);
    expect(providerSelects[3]).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('switch', { name: 'Ask Before Generating' })[1]).toHaveProperty('disabled', false);
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Provider' })[0]!);
    expect(screen.getByRole('option', { name: 'Codex (built-in)' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Provider' })[2]!);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('anchors and focuses an open menu while provider choices are refreshing', async () => {
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} providers={providers()} providersLoading onRefreshProviders={() => undefined} defaultModels={null} />);
    expect(screen.queryByRole('region', { name: 'Provider API key setup' })).toBeNull();
    const trigger = screen.getAllByRole('combobox', { name: 'Provider' })[2]!;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = await screen.findByRole('listbox');
    await waitFor(() => expect(document.activeElement).toBe(menu));
    expect(menu.closest('[data-radix-popper-content-wrapper]')).toBeTruthy();
    expect(menu.getAttribute('data-side')).toBe('bottom');
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('shows four lanes with Image Editing, route choice, and no preview toggle', () => {
    const onChange = vi.fn();
    render(<ProjectSettingsFields settings={settings()} onChange={onChange} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={null} />);
    expect(screen.getByRole('button', { name: 'Image Editing' })).toBeTruthy();
    expect(screen.getAllByRole('combobox', { name: 'Provider' })).toHaveLength(4);
    expect(screen.getAllByRole('combobox', { name: 'Model' })).toHaveLength(4);
    expect(screen.queryByText('Show Generation Previews')).toBeNull();
    const chooseSwitches = screen.getAllByRole('switch', { name: 'Choose Provider and Model Each Time' });
    expect(chooseSwitches).toHaveLength(4);
    fireEvent.click(chooseSwitches[1]!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      generation: expect.objectContaining({
        imageEdit: expect.objectContaining({ chooseRouteBeforeGenerating: false }),
        image: expect.objectContaining({ chooseRouteBeforeGenerating: true }),
      }),
    }));
  });

  it('disables the model select when no models are available', () => {
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={{ state: 'notSynced' }} />);
    const model = screen.getAllByRole('combobox', { name: 'Model' })[1]!;
    expect(model).toHaveProperty('disabled', true);
    expect(model.textContent).toContain('No models available');
  });

  it('lists the families for the selected provider and saves a chosen model by key and name', () => {
    const onChange = vi.fn();
    render(<ProjectSettingsFields settings={settings()} onChange={onChange} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={defaultModels()} />);
    const model = screen.getAllByRole('combobox', { name: 'Model' })[1]!;
    expect(model.textContent).toContain('Fictional Edit');
    fireEvent.click(model);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Fictional Edit',
      'Fictional Edit Plus',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Fictional Edit Plus' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      generation: expect.objectContaining({
        imageEdit: expect.objectContaining({ model: { key: 'fictional-edit-plus', name: 'Fictional Edit Plus' } }),
      }),
    }));
  });

  it('keeps a saved model that is no longer listed and clears the model when the provider changes', () => {
    const onChange = vi.fn();
    const value = settings();
    value.generation.imageEdit.model = { key: 'retired-edit', name: 'Retired Edit' };
    render(<ProjectSettingsFields settings={value} onChange={onChange} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={defaultModels()} />);
    expect(screen.getByText('Retired Edit (not in current Renku skills)')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Provider' })[1]!);
    fireEvent.click(screen.getByRole('option', { name: 'Replicate' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      generation: expect.objectContaining({
        imageEdit: expect.objectContaining({ provider: 'replicate', model: null }),
      }),
    }));
  });

  it('retains the configured maximum when concurrency is switched off', () => {
    const onChange = vi.fn();
    const value = settings();
    value.generation.video.runGenerationsConcurrently = true;
    value.generation.video.maxConcurrentGenerations = 3;
    render(<ProjectSettingsFields settings={value} onChange={onChange} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} defaultModels={null} />);
    fireEvent.click(screen.getAllByRole('switch', { name: 'Run Generations Concurrently' })[2]!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      generation: expect.objectContaining({
        video: expect.objectContaining({ runGenerationsConcurrently: false, maxConcurrentGenerations: 3 }),
      }),
    }));
  });
});

function defaultModels(): DefaultModelListResource {
  return {
    state: 'synced',
    syncedAt: '2026-10-12T10:00:00.000Z',
    lanes: {
      image: [],
      imageEdit: [
        { model: 'fictional-edit', name: 'Fictional Edit', providers: ['fal-ai'], recommendedFor: ['fal-ai'] },
        { model: 'fictional-edit-plus', name: 'Fictional Edit Plus', providers: ['fal-ai', 'replicate'], recommendedFor: [] },
        { model: 'fictional-host-edit', name: 'Fictional Host Edit', providers: ['codex'], recommendedFor: ['codex'] },
      ],
      video: [],
      audio: [],
    },
  };
}

function providers(): ProviderCredentialStatus[] {
  return [
    { provider: 'fal-ai', label: 'Fal.ai', configured: true },
    { provider: 'pika', label: 'Pika', configured: false },
    { provider: 'replicate', label: 'Replicate', configured: true },
    { provider: 'wavespeed-ai', label: 'WaveSpeed', configured: false },
    { provider: 'elevenlabs', label: 'ElevenLabs', configured: true },
    { provider: 'world-labs', label: 'World Labs', configured: true },
  ];
}

function settings(): ProjectSettingsDocument {
  return {
    version: 8,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      enableProviderPromptExpansion: true,
      image: {
        provider: 'codex',
        model: null,
        chooseRouteBeforeGenerating: true,
        askBeforeGenerating: false,
        runGenerationsConcurrently: true,
        maxConcurrentGenerations: 5,
      },
      imageEdit: {
        provider: 'fal-ai',
        model: null,
        chooseRouteBeforeGenerating: true,
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 1,
      },
      video: {
        provider: 'fal-ai',
        model: null,
        chooseRouteBeforeGenerating: true,
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 1,
      },
      audio: {
        provider: 'elevenlabs',
        model: null,
        chooseRouteBeforeGenerating: true,
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 1,
      },
    },
    casting: { routes: [] },
  };
}
