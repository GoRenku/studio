// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneShotVideoTake,
  GenerationReferenceSlotSelectionInput,
  ShotVideoTakeDraftReferenceSections,
} from '@gorenku/studio-core/client';
import { readSceneDialogueAudioWorkspace } from '@/services/studio-scene-dialogue-audio-api';
import { SceneShotDialogsTab } from './scene-shot-dialogs-tab';

vi.mock('@/services/studio-scene-dialogue-audio-api', () => ({
  readSceneDialogueAudioWorkspace: vi.fn(),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

describe('SceneShotDialogsTab', () => {
  beforeEach(() => {
    vi.mocked(readSceneDialogueAudioWorkspace).mockReset();
    vi.mocked(readSceneDialogueAudioWorkspace).mockResolvedValue(
      dialogueWorkspace() as never
    );
  });

  it('renders every exact Scene dialogue choice', async () => {
    renderTab();
    expect(await screen.findByText('Urban')).toBeTruthy();
    expect(screen.getByText('Hold the gate.')).toBeTruthy();
    expect(screen.getByText('Take 1')).toBeTruthy();
  });

  it('preserves dialogue audio playback controls', async () => {
    renderTab();
    const play = await screen.findByRole('button', {
      name: 'Play dialogue audio',
    });
    expect(play).toBeTruthy();
  });

  it('persists include and exclude through the exact take selection', async () => {
    const onSetReference = vi.fn().mockResolvedValue(undefined);
    renderTab({ onSetReference });
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Exclude Urban dialogue audio/i,
      })
    );

    await waitFor(() =>
      expect(onSetReference).toHaveBeenCalledWith(expect.objectContaining({ reference: null }))
    );
  });

  it('preserves unsupported-model capability guidance', async () => {
    const refs = references();
    refs.dialogueAudioCapability = {
      state: 'unsupported',
      supported: false,
      selectedCount: 1,
      maxCount: null,
      modelLabel: 'Seedance 2.0',
      message: 'This model does not use audio references.',
      diagnostics: [],
    };
    renderTab({ references: refs });
    expect(
      await screen.findByText('This model does not use audio references.')
    ).toBeTruthy();
  });

  it('preserves over-limit capability guidance', async () => {
    const refs = references();
    refs.dialogueAudioCapability = {
      state: 'over-limit',
      supported: true,
      selectedCount: 4,
      maxCount: 3,
      modelLabel: 'Seedance 2.0',
      message: 'Seedance 2.0 allows up to 3 audio references per generation.',
      diagnostics: [],
    };
    renderTab({ references: refs });
    expect(
      await screen.findByText(
        'Seedance 2.0 allows up to 3 audio references per generation.'
      )
    ).toBeTruthy();
  });

  it('publishes saved feedback after a dialogue selection mutation', async () => {
    const onSaveNotificationChange = vi.fn();
    renderTab({
      onSaveNotificationChange,
      onSetReference: vi.fn().mockResolvedValue(undefined),
    });
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Exclude Urban dialogue audio/i,
      })
    );
    await waitFor(() =>
      expect(onSaveNotificationChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'saved' })
      )
    );
  });
});

function renderTab(overrides: {
  references?: ShotVideoTakeDraftReferenceSections;
  onSetReference?: (selection: GenerationReferenceSlotSelectionInput) => Promise<void>;
  onSaveNotificationChange?: ReturnType<typeof vi.fn>;
} = {}) {
  return render(
    <SceneShotDialogsTab
      projectName='constantinople'
      sceneId='scene_001'
      castMemberImages={{}}
      take={take()}
      references={overrides.references ?? references()}
      onSetReference={overrides.onSetReference ?? vi.fn().mockResolvedValue(undefined)}
      onSaveNotificationChange={overrides.onSaveNotificationChange}
    />
  );
}

function take(): SceneShotVideoTake {
  return {
    takeId: 'take_001',
    sceneId: 'scene_001',
    sourceShotListId: 'shot_list_001',
    title: 'Take 1',
    shotIds: ['shot_001'],
    picked: false,
    video: null,
    state: {
      version: 3,
      structure: { mode: 'continuous', sharedDirection: {} },
    },
    status: {
      editability: {
        state: 'editable',
        diagnostics: [],
        message: 'This take is editable.',
      },
      resolvability: {
        state: 'resolvable',
        diagnostics: [],
        message: 'All references resolve.',
      },
      archive: { state: 'active', message: 'This take is active.' },
      history: { differences: [], message: 'No differences.' },
    },
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  };
}

function references(): ShotVideoTakeDraftReferenceSections {
  return {
    kind: 'draft',
    general: [],
    genericReferences: [],
    lookbook: [],
    castMembers: [],
    locations: [],
    dialogueAudio: [{
      selectionId: 'selection_dialogue_take_001',
      dialogueId: 'dialogue_001',
      castMemberId: 'cast_urban',
      speakerName: 'Urban',
      plainText: 'Hold the gate.',
      audioState: 'ready',
      selectedTake: {
        takeId: 'dialogue_take_001',
        takeLabel: 'Take 1',
        createdAt: '2026-07-12T00:00:00.000Z',
        assetId: 'asset_dialogue_001',
        assetFileId: 'file_dialogue_001',
      },
      availableTakes: [{
        takeId: 'dialogue_take_001',
        selectionId: 'selection_dialogue_take_001',
        selection: {
          placement: { kind: 'slot', sectionId: 'dialogue', slotId: 'dialogue-audio', subject: { kind: 'sceneDialogue', id: 'dialogue_001' } },
          reference: { kind: 'asset-file', assetId: 'asset_dialogue_001', assetFileId: 'file_dialogue_001' },
        },
      }],
      takeCount: 1,
      defaultIncluded: true,
      included: true,
      required: false,
      unavailableReason: null,
      card: {
        state: 'selected-ready',
        selectionId: 'selection_dialogue_take_001',
        defaultIncluded: true,
        included: true,
        required: false,
        previews: [],
        diagnostics: [],
        selection: {
          placement: { kind: 'slot', sectionId: 'dialogue', slotId: 'dialogue-audio', subject: { kind: 'sceneDialogue', id: 'dialogue_001' } },
          reference: { kind: 'asset-file', assetId: 'asset_dialogue_001', assetFileId: 'file_dialogue_001' },
        },
      },
    }],
    dialogueAudioCapability: {
      state: 'ok',
      supported: true,
      selectedCount: 1,
      maxCount: 3,
      modelLabel: 'Seedance 2.0',
      message: '1 dialogue reference selected',
      diagnostics: [],
    },
  };
}

function dialogueWorkspace() {
  return {
    purpose: 'scene.dialogue-audio' as const,
    target: { kind: 'scene' as const, sceneId: 'scene_001' },
    project: {
      name: 'constantinople',
      title: 'Constantinople',
      baseLanguageCode: null,
    },
    scene: { id: 'scene_001', title: 'The Gate', settingLabel: null },
    dialogues: [{
      dialogueId: 'dialogue_001',
      castMemberId: 'cast_urban',
      speakerName: 'Urban',
      plainText: 'Hold the gate.',
    }],
    castMemberLabels: { cast_urban: 'Urban' },
    castVoicesByCastMemberId: {},
    audioByDialogueId: {
      dialogue_001: {
        id: 'audio_001',
        sceneId: 'scene_001',
        dialogueId: 'dialogue_001',
        castMemberId: 'cast_urban',
        castVoiceId: null,
        modelChoice: 'elevenlabs/eleven_v3' as const,
        plainText: 'Hold the gate.',
        v3Text: 'Hold the gate.',
        voiceSettings: {},
        outputFormat: 'mp3_44100_128',
        languageCode: null,
        takes: [{
          takeId: 'dialogue_take_001',
          label: 'Take 1',
          assetId: 'asset_dialogue_001',
          assetFileId: 'file_dialogue_001',
          createdAt: '2026-07-12T00:00:00.000Z',
          durationSeconds: 1.5,
          mediaGenerationRunId: 'run_001',
          url: '/audio.mp3',
        }],
        createdAt: '2026-07-12T00:00:00.000Z',
        updatedAt: '2026-07-12T00:00:00.000Z',
      },
    },
    models: [],
    defaults: {
      modelChoice: 'elevenlabs/eleven_v3' as const,
      outputFormat: 'mp3_44100_128',
      languageCode: null,
      voiceSettings: {},
    },
    resourceKeys: [],
  };
}
