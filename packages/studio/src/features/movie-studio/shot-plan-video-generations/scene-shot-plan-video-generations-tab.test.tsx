// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SceneShotPlanVideoGenerationsTab } from './scene-shot-plan-video-generations-tab';

const mocks = vi.hoisted(() => ({
  useSceneShotPlanVideoGenerations: vi.fn(),
}));

vi.mock('./use-scene-shot-plan-video-generations', () => ({
  useSceneShotPlanVideoGenerations:
    mocks.useSceneShotPlanVideoGenerations,
}));

vi.mock('./shot-plan-video-generation-group', () => ({
  ShotPlanVideoGenerationGroup: ({
    assets,
  }: {
    assets: Array<{ id: string; title: string }>;
  }) => <div>{assets.map((asset) => asset.title).join(', ')}</div>,
}));

describe('SceneShotPlanVideoGenerationsTab', () => {
  it('renders active Shot Plan groups before Miscellaneous and opens the first group', () => {
    mocks.useSceneShotPlanVideoGenerations.mockReturnValue({
      resource: {
        sceneId: 'scene_opening',
        groups: [
          {
            kind: 'shotPlan',
            shotPlan: { id: 'plan_one', title: 'Council coverage' },
            assets: [
              { id: 'asset_one', title: 'Opening video' },
              { id: 'asset_two', title: 'Second video' },
            ],
          },
          {
            kind: 'miscellaneous',
            assets: [{ id: 'asset_misc', title: 'Detached video' }],
          },
        ],
        resourceKeys: [
          'surface:scene:scene_opening:video-generations',
        ],
      },
      error: null,
      loading: false,
      retry: vi.fn(),
    });

    render(
      <SceneShotPlanVideoGenerationsTab
        projectName='constantinople'
        sceneId='scene_opening'
      />,
    );

    const triggers = screen.getAllByRole('button');
    expect(triggers.map((trigger) => trigger.textContent?.trim())).toEqual([
      'Council coverage2',
      'Miscellaneous1',
    ]);
    expect(screen.getByText('Opening video, Second video')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Miscellaneous/ }));
    expect(screen.getByText('Detached video')).toBeTruthy();
  });

  it('keeps the empty state quiet', () => {
    mocks.useSceneShotPlanVideoGenerations.mockReturnValue({
      resource: {
        sceneId: 'scene_opening',
        groups: [],
        resourceKeys: [
          'surface:scene:scene_opening:video-generations',
        ],
      },
      error: null,
      loading: false,
      retry: vi.fn(),
    });

    render(
      <SceneShotPlanVideoGenerationsTab
        projectName='constantinople'
        sceneId='scene_opening'
      />,
    );

    expect(screen.getByText('No generated videos yet.')).toBeTruthy();
  });
});
