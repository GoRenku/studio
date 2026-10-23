// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SceneShotPlanVideoGenerationsTab } from './scene-shot-plan-video-generations-tab';

const mocks = vi.hoisted(() => ({
  useSceneShotPlanVideoGenerations: vi.fn(),
  useSceneShotPlans: vi.fn(),
}));

vi.mock('../shot-plans/use-scene-shot-plans', () => ({
  useSceneShotPlans: mocks.useSceneShotPlans,
}));

vi.mock('./use-scene-shot-plan-video-generations', () => ({
  useSceneShotPlanVideoGenerations:
    mocks.useSceneShotPlanVideoGenerations,
}));

vi.mock('./shot-plan-video-generation-group', () => ({
  ShotPlanVideoGenerationGroup: ({
    assetFiles,
  }: {
    assetFiles: Array<{ id: string; title: string }>;
  }) => <div>{assetFiles.map((assetFile) => assetFile.title).join(', ')}</div>,
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
            assetFiles: [
              { id: 'asset_one', title: 'Opening video' },
              { id: 'asset_two', title: 'Second video' },
            ],
          },
          {
            kind: 'miscellaneous',
            assetFiles: [{ id: 'asset_misc', title: 'Detached video' }],
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
        sceneHeading='EXT. HARBOR - DUSK'
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

  it.each([
    [0, 'Video takes start from a shot plan', 'Plan the shots for “EXT. HARBOR - DUSK”, then generate video takes.'],
    [1, 'No video takes yet', 'Generate video takes for the shots in “EXT. HARBOR - DUSK”.'],
  ] as const)('asks for the next request when there are no videos (%s shot plans)', (shotPlanCount, title, request) => {
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
    mocks.useSceneShotPlans.mockReturnValue({
      resource: {
        sceneId: 'scene_opening',
        shotPlans: Array.from({ length: shotPlanCount }, (_, index) => ({ shotPlan: { id: `plan_${index}` } })),
        warnings: [],
      },
      error: null,
      reload: vi.fn(),
    });

    render(
      <SceneShotPlanVideoGenerationsTab
        projectName='constantinople'
        sceneId='scene_opening'
        sceneHeading='EXT. HARBOR - DUSK'
      />,
    );

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(request)).toBeTruthy();
  });
});
