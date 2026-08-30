// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneDialogueAudioTakesTab } from './scene-dialogue-audio-takes-tab';

describe('SceneDialogueAudioTakesTab', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the workflow selection and sends focused pick and clear intents', () => {
    const onPickTake = vi.fn();
    const onClearSelection = vi.fn();
    render(
      <SceneDialogueAudioTakesTab
        actionDisabled={false}
        player={{
          playingUrl: null,
          progressByUrl: {},
          durationByUrl: {},
          toggle: vi.fn(),
          seek: vi.fn(),
        }}
        selectedTakeId='take_1'
        takes={[
          take('take_1', '2026-08-30T10:00:00.000Z'),
          take('take_2', '2026-08-30T11:00:00.000Z'),
        ]}
        onClearSelection={onClearSelection}
        onPickTake={onPickTake}
      />,
    );

    expect(screen.getByText('Selected')).toBeTruthy();
    const pickButtons = screen.getAllByRole('button', { name: 'Pick' });
    expect(pickButtons).toHaveLength(2);
    expect((pickButtons[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pickButtons[0]!);
    expect(onPickTake).toHaveBeenCalledWith('take_2');
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClearSelection).toHaveBeenCalledOnce();
  });
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function take(takeId: string, createdAt: string) {
  return {
    takeId,
    sceneDialogueAudioId: 'audio_1',
    assetId: `asset_${takeId}`,
    assetFileId: `file_${takeId}`,
    modelChoice: 'elevenlabs/eleven_v3' as const,
    castVoiceId: 'voice_1',
    castVoiceName: 'Urban',
    provider: 'elevenlabs' as const,
    providerVoiceId: 'provider_voice_1',
    providerTextSnapshot: 'Exact dialogue.',
    plainTextSnapshot: 'Exact dialogue.',
    v3TextSnapshot: 'Exact dialogue.',
    textTreatment: 'elevenlabs-v3-audio-tags' as const,
    voiceSettingsSnapshot: {},
    outputFormat: 'mp3_44100_128',
    languageCode: null,
    createdAt,
    url: `/audio/${takeId}`,
  };
}
