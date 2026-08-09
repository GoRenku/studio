// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenePanel } from './scene-panel';

vi.mock('@/services/screenplay', () => ({
  readScreenplayScene: vi.fn(() =>
    Promise.resolve({
      scene: {
        id: 'scene_bombardment',
        productionNumber: '1',
        heading: 'EXT. THEODOSIAN WALLS - DAWN',
        title: 'Bombardment',
        blocks: [],
      },
      references: [],
    })
  ),
  readSceneDialogueAudioWorkspace: vi.fn(() =>
    Promise.resolve({
      purpose: 'scene.dialogue-audio',
      target: { kind: 'scene', sceneId: 'scene_bombardment' },
      project: {
        projectName: 'basilica',
        title: 'Basilica',
        baseLanguageCode: null,
      },
      scene: {
        id: 'scene_bombardment',
        heading: 'EXT. THEODOSIAN WALLS - DAWN',
        title: 'Bombardment',
      },
      dialogues: [],
      castMemberLabels: {},
      castVoicesByCastMemberId: {},
      audioByTurnId: {},
      models: [],
      defaults: {
        modelChoice: 'elevenlabs/eleven_v3',
        outputFormat: 'mp3_44100_128',
        languageCode: null,
        voiceSettings: {},
      },
      resourceKeys: [],
    })
  ),
}));

vi.mock('../shot-plans/scene-shot-plans-tab', () => ({
  SceneShotPlansTab: () => <div>Shot Plans</div>,
}));
vi.mock('../shot-plan-video-generations/scene-shot-plan-video-generations-tab', () => ({
  SceneShotPlanVideoGenerationsTab: () => <div>Generations</div>,
}));
vi.mock('./scene-beats-tab', () => ({
  SceneBeatsTab: () => <div>Beats</div>,
}));

describe('ScenePanel', () => {
  it('uses the exact production number in the Scene header', async () => {
    const onHeaderTitleChange = vi.fn();
    render(
      <ScenePanel
        projectName='basilica'
        sceneId='scene_bombardment'
        onSelect={vi.fn()}
        onHeaderTitleChange={onHeaderTitleChange}
      />
    );

    await waitFor(() =>
      expect(onHeaderTitleChange).toHaveBeenCalledWith('1 - Bombardment')
    );
    expect(screen.getByText('EXT. THEODOSIAN WALLS - DAWN')).toBeTruthy();
  });
});
