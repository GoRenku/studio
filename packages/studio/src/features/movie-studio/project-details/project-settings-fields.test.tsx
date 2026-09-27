// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ProjectSettingsDocument, ProviderCredentialStatus } from '@gorenku/studio-core/client';
import { ProjectSettingsFields } from './project-settings-fields';

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('ProjectSettingsFields', () => {
  it('shows keyed general providers, Audio-only ElevenLabs, and Image-only Codex', () => {
    const onRefreshProviders = vi.fn();
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} providers={providers()} providersLoading={false} onRefreshProviders={onRefreshProviders} />);
    expect(screen.getByRole('button', { name: 'Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Image Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Video Generation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Audio Generation' })).toBeTruthy();
    expect(screen.getByText('ChatGPT Images 2.5 (Codex)')).toBeTruthy();
    expect(screen.getByText('ElevenLabs')).toBeTruthy();
    expect((screen.getByRole('switch', {
      name: 'Enable prompt expansion at the provider level when available for a model',
    }) as HTMLButtonElement).getAttribute('data-state')).toBe('checked');
    const providerSelects = screen.getAllByRole('combobox', { name: 'Provider' });
    fireEvent.click(providerSelects[0]!);
    expect(screen.getByRole('option', { name: 'ChatGPT Images 2.5 (Codex)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Fal.ai' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Replicate' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'ElevenLabs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'World Labs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Pika' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(providerSelects[1]!);
    expect(screen.getByRole('option', { name: 'Fal.ai' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Replicate' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'ElevenLabs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'World Labs' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'ChatGPT Images 2.5 (Codex)' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(providerSelects[2]!);
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
    render(<ProjectSettingsFields settings={value} onChange={() => undefined} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} />);
    expect(screen.getByText('Pika (API key missing)')).toBeTruthy();
    expect(screen.getByText('This provider has no saved API key.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Provider' })[2]!);
    expect(screen.queryByRole('option', { name: 'Pika' })).toBeNull();
  });

  it('keeps a keyed special provider saved in the wrong media setting without claiming its key is missing', () => {
    const value = settings();
    value.generation.image.provider = 'elevenlabs';
    value.generation.video.provider = 'world-labs';
    render(<ProjectSettingsFields settings={value} onChange={() => undefined} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} />);
    expect(screen.getByText('ElevenLabs (unavailable here)')).toBeTruthy();
    expect(screen.getByText('World Labs (unavailable here)')).toBeTruthy();
    expect(screen.getAllByText('This provider is not available for this setting.')).toHaveLength(2);
    expect(screen.queryByText('This provider has no saved API key.')).toBeNull();
  });

  it('leaves Video unavailable when ElevenLabs is the only configured provider', () => {
    const keyedAudio = providers().map((provider) => ({ ...provider, configured: provider.provider === 'elevenlabs' }));
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} providers={keyedAudio} providersLoading={false} onRefreshProviders={() => undefined} />);
    const providerSelects = screen.getAllByRole('combobox', { name: 'Provider' });
    expect(providerSelects[1]).toHaveProperty('disabled', true);
    expect(providerSelects[2]).toHaveProperty('disabled', false);
    expect(screen.getByText('No providers available')).toBeTruthy();
    expect(screen.queryByText('No API keys added')).toBeNull();
  });

  it('shows no external choices without saved keys while keeping Codex', () => {
    const onChange = vi.fn();
    render(<ProjectSettingsFields settings={settings()} onChange={onChange} providers={providers().map((provider) => ({ ...provider, configured: false }))} providersLoading={false} onRefreshProviders={() => undefined} />);
    expect(screen.getByRole('region', { name: 'Provider API key setup' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add API keys' })).toHaveLength(1);
    expect(screen.getAllByText('No API keys added')).toHaveLength(2);
    const providerSelects = screen.getAllByRole('combobox', { name: 'Provider' });
    expect(providerSelects[1]).toHaveProperty('disabled', true);
    expect(providerSelects[2]).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('switch', { name: 'Ask Before Generating' })[1]).toHaveProperty('disabled', false);
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Provider' })[0]!);
    expect(screen.getByRole('option', { name: 'ChatGPT Images 2.5 (Codex)' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Provider' })[1]!);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('anchors and focuses an open menu while provider choices are refreshing', async () => {
    render(<ProjectSettingsFields settings={settings()} onChange={() => undefined} providers={providers()} providersLoading onRefreshProviders={() => undefined} />);
    expect(screen.queryByRole('region', { name: 'Provider API key setup' })).toBeNull();
    const trigger = screen.getAllByRole('combobox', { name: 'Provider' })[1]!;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = await screen.findByRole('listbox');
    await waitFor(() => expect(document.activeElement).toBe(menu));
    expect(menu.closest('[data-radix-popper-content-wrapper]')).toBeTruthy();
    expect(menu.getAttribute('data-side')).toBe('bottom');
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('retains the configured maximum when concurrency is switched off', () => {
    const onChange = vi.fn();
    const value = settings();
    value.generation.video.runGenerationsConcurrently = true;
    value.generation.video.maxConcurrentGenerations = 3;
    render(<ProjectSettingsFields settings={value} onChange={onChange} providers={providers()} providersLoading={false} onRefreshProviders={() => undefined} />);
    fireEvent.click(screen.getAllByRole('switch', { name: 'Run Generations Concurrently' })[1]!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      generation: expect.objectContaining({
        video: expect.objectContaining({ runGenerationsConcurrently: false, maxConcurrentGenerations: 3 }),
      }),
    }));
  });
});

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
    version: 6,
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
      image: { provider: 'codex', askBeforeGenerating: false, runGenerationsConcurrently: true, maxConcurrentGenerations: 5 },
      video: { provider: 'fal-ai', askBeforeGenerating: true, runGenerationsConcurrently: false, maxConcurrentGenerations: 1 },
      audio: { provider: 'elevenlabs', askBeforeGenerating: true, runGenerationsConcurrently: false, maxConcurrentGenerations: 1 },
    },
  };
}
