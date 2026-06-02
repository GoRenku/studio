// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SceneNarrativeResourceResponse,
  SceneShotListResourceResponse,
} from '@/services/studio-project-contracts';
import {
  readSceneNarrativeResource,
  readSceneShotListResource,
} from '@/services/studio-screenplay-api';
import { ScenePanel } from './scene-panel';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneNarrativeResource: vi.fn(),
  readSceneShotListResource: vi.fn(),
}));

describe('ScenePanel', () => {
  beforeEach(() => {
    vi.mocked(readSceneNarrativeResource).mockReset();
    vi.mocked(readSceneShotListResource).mockReset();
  });

  it('opens the Shots tab when the same scene receives a shot deep link', async () => {
    vi.mocked(readSceneNarrativeResource).mockResolvedValue(sceneNarrative());
    vi.mocked(readSceneShotListResource).mockResolvedValue(sceneShotList());

    const { rerender } = render(
      <ScenePanel
        projectName='constantinople'
        sceneId='scene_hook'
        onSelect={vi.fn()}
      />
    );

    await screen.findByText('Workers prepare the city walls before sunrise.');
    expect(
      screen.getByRole('tab', { name: 'Narrative' }).getAttribute('aria-selected')
    ).toBe('true');

    rerender(
      <ScenePanel
        projectName='constantinople'
        sceneId='scene_hook'
        shotId='shot_001'
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: 'Shots' }).getAttribute('aria-selected')
      ).toBe('true');
    });
    await screen.findByText('No shot list yet.');
  });
});

function sceneNarrative(): SceneNarrativeResourceResponse {
  return {
    act: {
      id: 'act_one',
      title: 'The Offer',
      sequenceCount: 1,
      sceneCount: 1,
    },
    sequence: {
      id: 'seq_offer',
      actId: 'act_one',
      number: 1,
      title: 'The Offer',
      purpose: 'Open with the bargain.',
      sceneCount: 1,
    },
    scene: {
      id: 'scene_hook',
      title: 'The Sound That Opens Stone',
      setting: {
        interiorExterior: 'EXT',
        locationIds: [],
        timeOfDay: 'DAWN',
      },
      blocks: [
        {
          type: 'action',
          text: 'Workers prepare the city walls before sunrise.',
        },
      ],
    },
    blocks: [
      {
        type: 'action',
        text: 'Workers prepare the city walls before sunrise.',
      },
    ],
    castMemberLabels: {},
    locationLabels: {},
    castMemberHandles: {},
    locationHandles: {},
  };
}

function sceneShotList(): SceneShotListResourceResponse {
  return {
    scene: {
      id: 'scene_hook',
      sequenceId: 'seq_offer',
      title: 'The Sound That Opens Stone',
    },
    sequence: {
      id: 'seq_offer',
      actId: 'act_one',
      number: 1,
      title: 'The Offer',
      sceneCount: 1,
    },
    act: {
      id: 'act_one',
      title: 'The Offer',
      sequenceCount: 1,
      sceneCount: 1,
    },
    projectAspectRatio: '16:9',
    activeShotListId: null,
    activeShotList: null,
    storyboardSheet: null,
    storyboardImagesByShotId: {},
    castMemberLabels: {},
    locationLabels: {},
  };
}
