// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ScreenplayImageReferenceWithHttp,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import { SceneShotDialogsTab } from './scene-shot-dialogs-tab';

const serviceMocks = vi.hoisted(() => ({
  readSceneDialogueAudioContext: vi.fn(),
  pickSceneDialogueAudioTake: vi.fn(),
  deleteSceneDialogueAudioTake: vi.fn(),
  updateShotGroupReferenceInclusion: vi.fn(),
  updateShotReferenceInclusion: vi.fn(),
}));

vi.mock('@/services/studio-scene-dialogue-audio-api', () => ({
  readSceneDialogueAudioContext: serviceMocks.readSceneDialogueAudioContext,
  pickSceneDialogueAudioTake: serviceMocks.pickSceneDialogueAudioTake,
  deleteSceneDialogueAudioTake: serviceMocks.deleteSceneDialogueAudioTake,
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  updateShotGroupReferenceInclusion:
    serviceMocks.updateShotGroupReferenceInclusion,
  updateShotReferenceInclusion: serviceMocks.updateShotReferenceInclusion,
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

describe('SceneShotDialogsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialogue audio cards without compact Pick or Delete actions', async () => {
    serviceMocks.readSceneDialogueAudioContext.mockResolvedValue(dialogueAudioContext());
    const { container } = render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{
          cast_urban: profileImage(),
        }}
        productionPlan={dialogueProductionPlan(1)}
      />
    );

    expect(container.querySelector('.flex.flex-col.gap-3')).toBeTruthy();
    expect(
      await screen.findByText('Seedance 2.0 allows up to 3 audio references per generation')
    ).toBeTruthy();
    expect(screen.getByText('1 / 3 selected')).toBeTruthy();
    expect(await screen.findByText('Urban')).toBeTruthy();
    expect(await screen.findByText('Take 1')).toBeTruthy();
    expect(screen.queryByText('Jun 12, 10:00 AM')).toBeNull();
    expect(screen.getByText('Hold the line.')).toBeTruthy();
    expect(screen.getByAltText('Urban profile image')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play dialogue audio' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pick' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('shows every scene dialogue while default-selecting only referenced dialogue', async () => {
    serviceMocks.readSceneDialogueAudioContext.mockResolvedValue(dialogueAudioContext());
    render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(1, ['shot_001'], [
          dialogueChoice({
            dialogueId: 'dialogue_urban',
            castMemberId: 'cast_urban',
            speakerName: 'Urban',
            plainText: 'Hold the line.',
            defaultIncluded: true,
            included: true,
          }),
          dialogueChoice({
            dependencyId: 'audio:scene-dialogue:dialogue_mara',
            dialogueId: 'dialogue_mara',
            castMemberId: 'cast_mara',
            speakerName: 'Mara',
            plainText: 'Keep your head down.',
            defaultIncluded: false,
            included: false,
          }),
        ])}
      />
    );

    expect(await screen.findByText('Urban')).toBeTruthy();
    expect(screen.getByText('Mara')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Exclude Urban dialogue audio/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Include Mara dialogue audio/ })
    ).toBeTruthy();
  });

  it('shows not-generated dialogue as planned audio with a cost estimate', async () => {
    serviceMocks.readSceneDialogueAudioContext.mockResolvedValue({
      audioByDialogueId: {},
    });
    render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(0, ['shot_001'], [
          dialogueChoice({
            pickedTake: null,
            takeCount: 0,
            audioState: 'not-generated',
            unavailableReason: 'Not generated yet',
            defaultIncluded: true,
            included: true,
            card: {
              state: 'selected-planned',
              mediaKind: 'audio',
              dependencyId: 'audio:scene-dialogue:dialogue_urban',
              defaultIncluded: true,
              included: true,
              required: false,
              inclusionOverride: null,
              pricing: { state: 'priced', estimatedUsd: 0.03 },
              previews: [],
              diagnostics: [],
            },
          }),
        ])}
      />
    );

    expect(await screen.findByText('Urban')).toBeTruthy();
    expect(screen.getByText('Not generated')).toBeTruthy();
    expect(screen.getByText('$0.03')).toBeTruthy();
  });

  it('shows route capability warnings without clearing selected dialogue', async () => {
    serviceMocks.readSceneDialogueAudioContext.mockResolvedValue(dialogueAudioContext());
    render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(1, ['shot_001'], [
          dialogueChoice({ included: true }),
          dialogueChoice({
            dependencyId: 'audio:scene-dialogue:dialogue_mara',
            dialogueId: 'dialogue_mara',
            castMemberId: 'cast_mara',
            speakerName: 'Mara',
            included: true,
          }),
        ], {
          state: 'unsupported',
          supported: false,
          selectedCount: 2,
          maxCount: null,
          modelLabel: 'Test model',
          message: 'This model does not use audio references',
          diagnostics: [],
        })}
      />
    );

    expect(await screen.findByText('This model does not use audio references')).toBeTruthy();
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Exclude Urban dialogue audio/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Exclude Mara dialogue audio/ })
    ).toBeTruthy();
  });

  it('shows over-limit capability warnings with max-count copy', async () => {
    serviceMocks.readSceneDialogueAudioContext.mockResolvedValue(dialogueAudioContext());
    render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(1, ['shot_001'], [
          dialogueChoice({ dependencyId: 'audio:scene-dialogue:dialogue_1', dialogueId: 'dialogue_1' }),
          dialogueChoice({ dependencyId: 'audio:scene-dialogue:dialogue_2', dialogueId: 'dialogue_2' }),
          dialogueChoice({ dependencyId: 'audio:scene-dialogue:dialogue_3', dialogueId: 'dialogue_3' }),
          dialogueChoice({ dependencyId: 'audio:scene-dialogue:dialogue_4', dialogueId: 'dialogue_4' }),
        ], {
          state: 'over-limit',
          supported: true,
          selectedCount: 4,
          maxCount: 3,
          modelLabel: 'Seedance 2.0',
          message: 'Seedance 2.0 allows up to 3 audio references per generation',
          diagnostics: [],
        })}
      />
    );

    expect(
      await screen.findByText('Seedance 2.0 allows up to 3 audio references per generation')
    ).toBeTruthy();
    expect(screen.getByText('4 / 3 selected')).toBeTruthy();
  });

  it('reloads dialogue audio context when plan take state changes', async () => {
    serviceMocks.readSceneDialogueAudioContext
      .mockResolvedValueOnce({ audioByDialogueId: {} })
      .mockResolvedValueOnce(dialogueAudioContext());
    const { rerender } = render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(0, ['shot_001'], [
          dialogueChoice({
            pickedTake: null,
            takeCount: 0,
            audioState: 'not-generated',
          }),
        ])}
      />
    );

    await waitFor(() => {
      expect(serviceMocks.readSceneDialogueAudioContext).toHaveBeenCalledTimes(1);
    });

    rerender(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(1)}
      />
    );

    await waitFor(() => {
      expect(serviceMocks.readSceneDialogueAudioContext).toHaveBeenCalledTimes(2);
    });
  });

  it('opens take management only when multiple takes are available', async () => {
    serviceMocks.readSceneDialogueAudioContext.mockResolvedValue(dialogueAudioContext());
    render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(2)}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /Take 1/ }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Urban' })).toBeTruthy();
    expect(within(dialog).getAllByRole('button', { name: 'Pick' })).toHaveLength(
      2
    );
  });

  it('uses group inclusion updates for multi-shot dialogue selections', async () => {
    serviceMocks.readSceneDialogueAudioContext.mockResolvedValue(dialogueAudioContext());
    serviceMocks.updateShotGroupReferenceInclusion.mockResolvedValue({
      resource: { projectName: 'constantinople', sceneId: 'scene_hook', scenes: [] },
    });
    render(
      <SceneShotDialogsTab
        projectName='constantinople'
        sceneId='scene_hook'
        castMemberImages={{}}
        productionPlan={dialogueProductionPlan(1, ['shot_001', 'shot_002'])}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /Exclude Urban dialogue audio/ }));

    await waitFor(() => {
      expect(serviceMocks.updateShotGroupReferenceInclusion).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_generation_001',
        {
          dependencyId: 'audio:scene-dialogue:dialogue_urban',
          inclusion: null,
        }
      );
    });
    expect(serviceMocks.updateShotReferenceInclusion).not.toHaveBeenCalled();
  });
});

function dialogueAudioContext() {
  return {
    audioByDialogueId: {
      dialogue_urban: {
        takes: [
          take('take_001', true, '2026-06-12T10:00:00.000Z'),
          take('take_002', false, '2026-06-12T11:00:00.000Z'),
        ],
      },
    },
  };
}

function take(takeId: string, picked: boolean, createdAt: string) {
  return {
    takeId,
    sceneDialogueAudioId: 'audio_001',
    assetId: `asset_${takeId}`,
    assetFileId: `file_${takeId}`,
    mediaGenerationRunId: `run_${takeId}`,
    modelChoice: 'elevenlabs/eleven_v3',
    castVoiceId: 'voice_001',
    castVoiceName: 'Urban voice',
    provider: 'elevenlabs',
    providerVoiceId: 'provider_voice',
    providerTextSnapshot: 'Hold the line.',
    plainTextSnapshot: 'Hold the line.',
    v3TextSnapshot: 'Hold the line.',
    textTreatment: 'plain-tts',
    voiceSettingsSnapshot: {},
    outputFormat: 'mp3_44100_128',
    languageCode: null,
    picked,
    createdAt,
    url: `/audio/${takeId}.mp3`,
  };
}

function profileImage(): ScreenplayImageReferenceWithHttp {
  return {
    assetId: 'asset_profile',
    relationshipId: 'relationship_profile',
    assetFileId: 'file_profile',
    title: 'Urban profile',
    fileRole: 'profile',
    mediaKind: 'image',
    mimeType: 'image/png',
    width: 512,
    height: 512,
    url: '/profile.png',
  };
}

function dialogueProductionPlan(
  takeCount: number,
  shotIds: string[] = ['shot_001'],
  dialogueAudio = [dialogueChoice({ takeCount })],
  dialogueAudioCapability: ShotVideoTakeProductionPlanReport['references']['dialogueAudioCapability'] = {
    state: 'ok',
    supported: true,
    selectedCount: dialogueAudio.filter((choice) => choice.included).length,
    maxCount: 3,
    modelLabel: 'Seedance 2.0',
    message: 'Seedance 2.0 allows up to 3 audio references per generation',
    diagnostics: [],
  }
): ShotVideoTakeProductionPlanReport {
  return {
    take: {
      takeId: 'take_generation_001',
      sceneId: 'scene_hook',
      shotListId: 'shot_list_hook',
      shotIds,
      title: 'Take generation',
      production: {},
      createdAt: '',
      updatedAt: '',
      status: {
      editability: {
        state: 'editable',
        diagnostics: [],
        message: 'This take is editable.',
      },
      resolvability: {
        state: 'resolvable',
        diagnostics: [],
        message: 'All tracked take references resolve.',
      },
      runnability: {
        state: 'not-evaluated',
        diagnostics: [],
        message: 'Run readiness is evaluated by shot-video preflight.',
      },
      archive: { state: 'active', message: 'This take is active.' },
      history: { differences: [], message: 'This take matches its recorded history snapshot.' },
    },
    },
    references: {
      general: [],
      lookbook: [],
      dialogueAudio,
      dialogueAudioCapability,
      castMembers: [],
      locations: [],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function dialogueChoice(
  overrides: Partial<
    ShotVideoTakeProductionPlanReport['references']['dialogueAudio'][number]
  > = {}
): ShotVideoTakeProductionPlanReport['references']['dialogueAudio'][number] {
  const dependencyId =
    overrides.dependencyId ?? 'audio:scene-dialogue:dialogue_urban';
  const defaultIncluded = overrides.defaultIncluded ?? false;
  const included = overrides.included ?? true;
  const required = overrides.required ?? false;
  return {
    dependencyId,
    dialogueId: 'dialogue_urban',
    castMemberId: 'cast_urban',
    speakerName: 'Urban',
    plainText: 'Hold the line.',
    pickedTake: {
      takeId: 'take_001',
      takeLabel: 'Take 1',
      createdAt: '2026-06-12T10:00:00.000Z',
      assetId: 'asset_take_001',
      assetFileId: 'file_take_001',
    },
    takeCount: 1,
    defaultIncluded,
    included,
    required,
    unavailableReason: null,
    audioState: 'ready',
    card: {
      state: included ? 'selected-ready' : 'available',
      mediaKind: 'audio',
      dependencyId,
      defaultIncluded,
      included,
      required,
      inclusionOverride: defaultIncluded ? null : 'include',
      pricing: { state: 'not-applicable', estimatedUsd: null },
      previews: [],
      diagnostics: [],
    },
    ...overrides,
  };
}
