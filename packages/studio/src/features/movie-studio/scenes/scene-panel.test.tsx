// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneBeatSheetResourceResponse,
  SceneNarrativeResourceResponse,
} from '@/services/studio-project-contracts';
import {
  readSceneBeatSheetResource,
  readSceneNarrativeResource,
} from '@/services/studio-screenplay-api';
import { ScenePanel } from './scene-panel';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneBeatSheetResource: vi.fn(),
  readSceneNarrativeResource: vi.fn(),
}));
vi.mock('../shot-plans/shot-plan-detail-page', () => ({
  ShotPlanDetailPage: () => <div>Focused Shot Plan detail</div>,
}));

describe('ScenePanel', () => {
  beforeEach(() => {
    vi.mocked(readSceneNarrativeResource).mockReset();
    vi.mocked(readSceneBeatSheetResource).mockReset();
    vi.mocked(readSceneNarrativeResource).mockResolvedValue(sceneNarrative());
    vi.mocked(readSceneBeatSheetResource).mockResolvedValue(sceneBeatSheet());
  });

  it('opens the Beats tab for a Beat deep link', async () => {
    render(
      <ScenePanel
        projectName='constantinople'
        sceneId='scene_hook'
        beatId='beat_001'
        onSelect={vi.fn()}
      />
    );

    expect(
      (await screen.findByRole('tab', { name: 'Beats' })).getAttribute(
        'aria-selected'
      )
    ).toBe('true');
    expect(await screen.findAllByText('The city prepares')).toHaveLength(2);
  });

  it('keeps Generations visible and disabled on the Shot Plans tab', async () => {
    const onSelect = vi.fn();
    render(
      <ScenePanel
        projectName='constantinople'
        sceneId='scene_hook'
        sceneTab='shotPlans'
        onSelect={onSelect}
      />
    );

    const generations = await screen.findByRole('tab', {
      name: 'Generations',
    });
    expect(generations.hasAttribute('disabled')).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(readSceneBeatSheetResource).not.toHaveBeenCalled();
  });

  it('reports the production-numbered scene title to the panel header', async () => {
    const onHeaderTitleChange = vi.fn();
    render(
      <ScenePanel
        projectName='constantinople'
        sceneId='scene_hook'
        onSelect={vi.fn()}
        onHeaderTitleChange={onHeaderTitleChange}
      />
    );

    await screen.findByText('Workers prepare the city walls.');
    expect(onHeaderTitleChange).toHaveBeenCalledWith(
      '01 - The Sound That Opens Stone'
    );
  });

  it('keeps the Scene tab bar under the only panel header in Shot Plan detail', async () => {
    const onSelect = vi.fn();
    const onHeaderActionChange = vi.fn();
    render(
      <ScenePanel
        projectName='constantinople'
        sceneId='scene_hook'
        sceneTab='shotPlans'
        shotPlanId='plan_one'
        shotId='shot_one'
        onSelect={onSelect}
        onHeaderActionChange={onHeaderActionChange}
      />
    );

    expect(
      (await screen.findByRole('tab', { name: 'Shot Plans' })).getAttribute(
        'aria-selected'
      )
    ).toBe('true');
    expect(screen.getByText('Focused Shot Plan detail')).not.toBeNull();

    await waitFor(() => {
      expect(
        onHeaderActionChange.mock.calls.some(([action]) => action !== null)
      ).toBe(true);
    });
    const action = onHeaderActionChange.mock.calls
      .map(([nextAction]) => nextAction)
      .find((nextAction) => nextAction !== null);
    render(action);
    fireEvent.click(screen.getByRole('button', {
      name: 'Back to Shot Plans',
    }));
    expect(onSelect).toHaveBeenCalledWith({
      type: 'scene',
      id: 'scene_hook',
      sceneTab: 'shotPlans',
    });
  });

  it('displays an inserted production-number suffix without a Scene prefix', async () => {
    vi.mocked(readSceneNarrativeResource).mockResolvedValue(sceneNarrative('22A'));
    const onHeaderTitleChange = vi.fn();
    render(
      <ScenePanel
        projectName='constantinople'
        sceneId='scene_hook'
        onSelect={vi.fn()}
        onHeaderTitleChange={onHeaderTitleChange}
      />
    );

    await screen.findByText('Workers prepare the city walls.');
    expect(onHeaderTitleChange).toHaveBeenCalledWith(
      '22A - The Sound That Opens Stone'
    );
  });
});

function sceneNarrative(productionNumber = '1'): SceneNarrativeResourceResponse {
  return {
    act: { id: 'act_one', title: 'The Offer', sequenceCount: 1, sceneCount: 1 },
    sequence: {
      id: 'seq_offer',
      actId: 'act_one',
      number: 1,
      title: 'The Offer',
      purpose: 'Open with the bargain.',
      sceneCount: 1,
    },
    productionNumber,
    scene: {
      id: 'scene_hook',
      title: 'The Sound That Opens Stone',
      setting: { interiorExterior: 'EXT', locationIds: [], timeOfDay: 'DAWN' },
      blocks: [{ type: 'action', text: 'Workers prepare the city walls.' }],
    },
    blocks: [{ type: 'action', text: 'Workers prepare the city walls.' }],
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
    castMemberHandles: {},
    locationHandles: {},
    dialogueAudio: {
      purpose: 'scene.dialogue-audio',
      target: { kind: 'scene', sceneId: 'scene_hook' },
      project: { name: 'constantinople', title: 'Constantinople', baseLanguageCode: null },
      scene: { id: 'scene_hook', title: 'The Sound That Opens Stone', settingLabel: 'EXT DAWN' },
      dialogues: [],
      castMemberLabels: {},
      castVoicesByCastMemberId: {},
      audioByDialogueId: {},
      models: [],
      defaults: {
        modelChoice: 'elevenlabs/eleven_v3',
        outputFormat: 'mp3_44100_128',
        languageCode: null,
        voiceSettings: {},
      },
      resourceKeys: [],
    },
  };
}

function sceneBeatSheet(): SceneBeatSheetResourceResponse {
  return {
    scene: { id: 'scene_hook', sequenceId: 'seq_offer', productionNumber: '1', title: 'The Sound That Opens Stone' },
    sequence: { id: 'seq_offer', actId: 'act_one', number: 1, title: 'The Offer', sceneCount: 1 },
    act: { id: 'act_one', title: 'The Offer', sequenceCount: 1, sceneCount: 1 },
    projectAspectRatio: '16:9',
    activeBeatSheetId: 'scene_beat_sheet_001',
    activeBeatSheet: {
      kind: 'sceneBeatSheet',
      sceneId: 'scene_hook',
      title: 'Opening Beats',
      summary: 'The city prepares.',
      narrativeProgression: 'The threat becomes immediate.',
      beats: [{
        id: 'beat_001',
        title: 'The city prepares',
        description: 'Workers ready the walls.',
        narrativeDevelopment: 'The threat becomes immediate.',
        narrativePurpose: 'Establish collective urgency.',
        castMemberIds: [],
        locationIds: [],
        screenplayBlockIndexes: [0],
      }],
    },
    storyboardImagesByBeatId: {},
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
  };
}
