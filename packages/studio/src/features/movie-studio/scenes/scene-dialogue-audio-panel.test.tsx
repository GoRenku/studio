// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  type MediaGenerationEstimateReport,
} from '@gorenku/studio-core/client';
import type { SceneDialogueAudioContextWithUrls } from '@/services/studio-scene-dialogue-audio-api';
import {
  deleteSceneDialogueAudioTake,
  estimateSceneDialogueAudioDraft,
  generateSceneDialogueAudioTake,
  saveSceneDialogueAudioSetup,
} from '@/services/studio-scene-dialogue-audio-api';
import { SceneDialogueAudioPanel } from './scene-dialogue-audio-panel';

vi.mock('@/services/studio-scene-dialogue-audio-api', () => ({
  deleteSceneDialogueAudioTake: vi.fn(),
  estimateSceneDialogueAudioDraft: vi.fn(),
  generateSceneDialogueAudioTake: vi.fn(),
  saveSceneDialogueAudioSetup: vi.fn(),
}));

describe('SceneDialogueAudioPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(estimateSceneDialogueAudioDraft).mockResolvedValue(estimateReport());
    vi.mocked(saveSceneDialogueAudioSetup).mockResolvedValue({
      context: savedContext('Bronze has no temper. [shouts] Men give it one.'),
      resourceKeys: [],
    });
    vi.mocked(generateSceneDialogueAudioTake).mockReset();
    vi.mocked(deleteSceneDialogueAudioTake).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autosaves edited dialog text and publishes the saved header status', async () => {
    const onSaveNotificationChange = vi.fn();

    render(
      <SceneDialogueAudioPanel
        projectName='constantinople'
        sceneId='scene_hook'
        dialogueId='dialogue_urban'
        context={baseContext()}
        player={player()}
        onClose={vi.fn()}
        onContextChange={vi.fn()}
        onSaveNotificationChange={onSaveNotificationChange}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Dialog Text' }), {
        target: { value: 'Bronze has no temper. [shouts] Men give it one.' },
      });
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveSceneDialogueAudioSetup).toHaveBeenCalledWith(
      'constantinople',
      'scene_hook',
      'dialogue_urban',
      expect.objectContaining({
        v3Text: 'Bronze has no temper. [shouts] Men give it one.',
      })
    );
    expect(onSaveNotificationChange).toHaveBeenCalledWith({
      state: 'saved',
      message: 'Saved',
    });
  });

  it('flushes pending dialog text when the panel unmounts before debounce completes', async () => {
    const { unmount } = render(
      <SceneDialogueAudioPanel
        projectName='constantinople'
        sceneId='scene_hook'
        dialogueId='dialogue_urban'
        context={baseContext()}
        player={player()}
        onClose={vi.fn()}
        onContextChange={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Dialog Text' }), {
        target: { value: 'Bronze has no temper. [urgent] Men give it one.' },
      });
      await Promise.resolve();
    });
    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(saveSceneDialogueAudioSetup).toHaveBeenCalledWith(
      'constantinople',
      'scene_hook',
      'dialogue_urban',
      expect.objectContaining({
        v3Text: 'Bronze has no temper. [urgent] Men give it one.',
      })
    );
  });
});

function baseContext(): SceneDialogueAudioContextWithUrls {
  return {
    purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
    target: { kind: 'scene', sceneId: 'scene_hook' },
    project: {
      name: 'constantinople',
      title: 'Constantinople',
      baseLanguageCode: null,
    },
    scene: {
      id: 'scene_hook',
      title: 'Bombardment',
      settingLabel: 'EXT DAWN',
    },
    dialogues: [
      {
        dialogueId: 'dialogue_urban',
        castMemberId: 'cast_urban',
        speakerName: 'Urban',
        plainText: 'Bronze has no temper. Men give it one.',
      },
    ],
    castMemberLabels: {
      cast_urban: 'Urban',
    },
    castVoicesByCastMemberId: {
      cast_urban: [
        {
          id: 'voice_urban',
          castMemberId: 'cast_urban',
          name: 'urban-primary',
          provider: 'elevenlabs',
          model: 'eleven_v3',
          voiceId: 'provider_voice_urban',
          purpose: 'Primary speaking voice for Urban dialogue and voice tests',
          usable: true,
        },
      ],
    },
    audioByDialogueId: {},
    models: [
      {
        modelChoice: 'elevenlabs/eleven_v3',
        label: 'Eleven v3',
        available: true,
        provider: 'elevenlabs',
        model: 'eleven_v3',
        mediaKind: 'audio',
        mode: 'text-to-speech',
        supportsAudioTags: true,
        textTreatment: 'elevenlabs-v3-audio-tags',
        defaultVoiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0,
          speed: 1,
          useSpeakerBoost: true,
        },
        outputFormats: ['mp3_44100_128'],
      },
    ],
    defaults: {
      modelChoice: 'elevenlabs/eleven_v3',
      outputFormat: 'mp3_44100_128',
      languageCode: null,
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0,
        speed: 1,
        useSpeakerBoost: true,
      },
    },
    resourceKeys: [],
  };
}

function estimateReport(): MediaGenerationEstimateReport {
  const spec = {
    purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
    target: {
      kind: 'sceneDialogue' as const,
      sceneId: 'scene_hook',
      dialogueId: 'dialogue_urban',
    },
    modelChoice: 'elevenlabs/eleven_v3' as const,
    castVoiceId: 'voice_urban',
    plainText: 'Bronze has no temper. Men give it one.',
    v3Text: 'Bronze has no temper. Men give it one.',
    voiceSettings: {
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      speed: 1,
      useSpeakerBoost: true,
    },
    outputFormat: 'mp3_44100_128',
    languageCode: null,
  };
  return {
    spec: {
      id: 'draft',
      purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
      target: spec.target,
      modelChoice: 'elevenlabs/eleven_v3',
      title: 'Urban dialogue audio',
      spec,
      createdAt: '2026-06-10T00:00:00.000Z',
      updatedAt: '2026-06-10T00:00:00.000Z',
    },
    providerPayload: {
      text: spec.v3Text,
      voice: 'provider_voice_urban',
    },
    estimate: {
      provider: 'elevenlabs',
      model: 'eleven_v3',
      mediaKind: 'audio',
      pricing: {
        function: 'costByCharacters',
        inputs: ['text'],
        pricePerCharacter: 0.0001,
      },
      estimatedCostUsd: 0.004,
      approvalToken: 'approval_token',
      billableUnits: { text: spec.v3Text },
      warnings: [],
    },
  };
}

function savedContext(v3Text: string): SceneDialogueAudioContextWithUrls {
  return {
    ...baseContext(),
    audioByDialogueId: {
      dialogue_urban: {
        id: 'scene_dialogue_audio_urban',
        sceneId: 'scene_hook',
        dialogueId: 'dialogue_urban',
        castMemberId: 'cast_urban',
        castVoiceId: 'voice_urban',
        modelChoice: 'elevenlabs/eleven_v3',
        plainText: 'Bronze has no temper. Men give it one.',
        v3Text,
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0,
          speed: 1,
          useSpeakerBoost: true,
        },
        outputFormat: 'mp3_44100_128',
        languageCode: null,
        takes: [],
        createdAt: '2026-06-10T00:00:00.000Z',
        updatedAt: '2026-06-10T00:00:00.000Z',
      },
    },
  };
}

function player() {
  return {
    playingUrl: null,
    progressByUrl: {},
    durationByUrl: {},
    toggle: vi.fn(),
    seek: vi.fn(),
  };
}
