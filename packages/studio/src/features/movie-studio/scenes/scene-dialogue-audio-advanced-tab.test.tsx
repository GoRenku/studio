// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneDialogueAudioModelChoiceReport,
  SceneDialogueAudioVoiceSettings,
} from '@gorenku/studio-core/client';
import { SceneDialogueAudioAdvancedTab } from './scene-dialogue-audio-advanced-tab';
import type { SceneDialogueAudioDraft } from './use-scene-dialogue-audio';

describe('SceneDialogueAudioAdvancedTab', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps Language Override switch enabled when the project base language is missing', () => {
    const onDraftChange = vi.fn();

    renderAdvancedTab({
      baseLanguageCode: null,
      onDraftChange,
    });

    const languageOverrideSwitch = screen.getByRole('switch', {
      name: 'Language Override',
    }) as HTMLButtonElement;
    const [languageSelect] = screen.getAllByRole('combobox') as HTMLButtonElement[];

    expect(languageOverrideSwitch.disabled).toBe(false);
    expect(languageOverrideSwitch.getAttribute('aria-checked')).toBe('false');
    expect(languageSelect?.disabled).toBe(true);

    fireEvent.click(languageOverrideSwitch);

    expect(onDraftChange).toHaveBeenCalledWith({ languageCode: 'en' });
  });

  it('turns Language Override on with the project base language when it exists', () => {
    const onDraftChange = vi.fn();

    renderAdvancedTab({
      baseLanguageCode: 'tr',
      onDraftChange,
    });

    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Language Override',
      })
    );

    expect(onDraftChange).toHaveBeenCalledWith({ languageCode: 'tr' });
  });
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderAdvancedTab(input: {
  baseLanguageCode: string | null;
  draft?: Partial<SceneDialogueAudioDraft>;
  onDraftChange?: (patch: Partial<SceneDialogueAudioDraft>) => void;
}) {
  const onVoiceSettingsChange = vi.fn();
  render(
    <SceneDialogueAudioAdvancedTab
      baseLanguageCode={input.baseLanguageCode}
      disabled={false}
      draft={{ ...draft(), ...input.draft }}
      selectedModel={model()}
      onDraftChange={input.onDraftChange ?? vi.fn()}
      onReset={vi.fn()}
      onVoiceSettingsChange={onVoiceSettingsChange}
    />
  );
}

function draft(): SceneDialogueAudioDraft {
  return {
    modelChoice: 'elevenlabs/eleven_v3',
    castVoiceId: 'voice_urban',
    plainText: 'Bronze has no temper. Men give it one.',
    v3Text: 'Bronze has no temper. Men give it one.',
    voiceSettings: voiceSettings(),
    outputFormat: 'mp3_44100_128',
    languageCode: null,
  };
}

function model(): SceneDialogueAudioModelChoiceReport {
  return {
    modelChoice: 'elevenlabs/eleven_v3',
    label: 'Eleven v3',
    available: true,
    provider: 'elevenlabs',
    model: 'eleven_v3',
    mediaKind: 'audio',
    mode: 'text-to-speech',
    supportsAudioTags: true,
    textTreatment: 'elevenlabs-v3-audio-tags',
    defaultVoiceSettings: voiceSettings(),
    outputFormats: ['mp3_44100_128'],
  };
}

function voiceSettings(): SceneDialogueAudioVoiceSettings {
  return {
    speed: 1,
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
  };
}
