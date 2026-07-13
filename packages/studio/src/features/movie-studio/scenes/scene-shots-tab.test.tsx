// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import { listShotVideoTakes } from '@/services/studio-shot-video-takes-api';
import { SceneShotsTab } from './scene-shots-tab';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSceneShotListResource: vi.fn(),
}));
vi.mock('@/services/studio-project-assets-api', () => ({
  readLocationAssets: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/studio-shot-video-takes-api', () => ({
  listShotVideoTakes: vi.fn(),
  createShotVideoTake: vi.fn(),
  readShotVideoTakeWorkspace: vi.fn(),
  setShotVideoTakeGenerationSpec: vi.fn(),
  estimateShotVideoTakeGeneration: vi.fn(),
  setShotVideoTakeGenerationReference: vi.fn(),
  setShotVideoTakeDirection: vi.fn(),
  setShotVideoTakeStructure: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('SceneShotsTab', () => {
  beforeEach(() => {
    vi.mocked(listShotVideoTakes).mockReset().mockResolvedValue({ takes: [] });
    vi.mocked(readSceneShotListResource).mockReset();
  });

  it('renders the empty state when there is no active Shot List', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource(null) as never
    );
    render(<SceneShotsTab projectName='constantinople' sceneId='scene_001' />);
    expect(await screen.findByText('No shot list yet.')).toBeTruthy();
  });

  it('lists Shots in order and updates the detail pane on selection', async () => {
    const onSelect = vi.fn();
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource([shot('shot_001', 'Gate Wide'), shot('shot_002', 'Urban Close')]) as never
    );
    render(
      <SceneShotsTab
        projectName='constantinople'
        sceneId='scene_001'
        onSelect={onSelect}
      />
    );

    expect((await screen.findAllByText('Gate Wide')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Urban Close'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ shotId: 'shot_002', shotTab: 'description' })
    );
  });

  it('preselects the rail row from a Shot deep link', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource([shot('shot_001', 'Gate Wide'), shot('shot_002', 'Urban Close')]) as never
    );
    render(
      <SceneShotsTab
        projectName='constantinople'
        sceneId='scene_001'
        shotId='shot_002'
      />
    );
    expect(await screen.findByText('The subject acts in Urban Close.')).toBeTruthy();
  });

  it('preserves the active Shot detail tab while selecting another Shot', async () => {
    const onSelect = vi.fn();
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource([shot('shot_001', 'Gate Wide'), shot('shot_002', 'Urban Close')]) as never
    );
    render(
      <SceneShotsTab
        projectName='constantinople'
        sceneId='scene_001'
        shotTab='composition'
        onSelect={onSelect}
      />
    );
    fireEvent.click(await screen.findByText('Urban Close'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ shotId: 'shot_002', shotTab: 'composition' })
    );
  });

  it('renders narrative fields and not raw ids', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource([shot('shot_001', 'Gate Wide')]) as never
    );
    render(<SceneShotsTab projectName='constantinople' sceneId='scene_001' />);
    expect(await screen.findByText('The subject acts in Gate Wide.')).toBeTruthy();
    expect(screen.queryByText('shot_001')).toBeNull();
  });

  it('renders the consolidated Shot detail tab bar', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource([shot('shot_001', 'Gate Wide')]) as never
    );
    render(<SceneShotsTab projectName='constantinople' sceneId='scene_001' />);
    await screen.findAllByText('Gate Wide');
    for (const label of [
      'Description',
      'Composition',
      'Motion',
      'Dialogs',
      'References',
      'AI Production',
    ]) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
  });

  it('shows the empty video stage with a disabled transport', async () => {
    vi.mocked(readSceneShotListResource).mockResolvedValue(
      resource([shot('shot_001', 'Gate Wide')]) as never
    );
    render(<SceneShotsTab projectName='constantinople' sceneId='scene_001' />);
    expect(await screen.findByText('No shot video yet')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Play shot' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});

function resource(shots: ReturnType<typeof shot>[] | null) {
  return {
    scene: {
      id: 'scene_001',
      sequenceId: 'sequence_001',
      title: 'The Gate',
      setting: { locationIds: [] },
    },
    sequence: {
      id: 'sequence_001',
      actId: 'act_001',
      number: 1,
      title: 'Opening',
      sceneCount: 1,
    },
    act: {
      id: 'act_001',
      title: 'Act 1',
      sequenceCount: 1,
      sceneCount: 1,
    },
    projectAspectRatio: '16:9',
    activeShotListId: shots ? 'shot_list_001' : null,
    activeShotList: shots
      ? {
          id: 'shot_list_001',
          title: 'Shots',
          summary: 'Coverage.',
          coverageStrategy: 'Continuous',
          shots,
        }
      : null,
    storyboardImagesByShotId: {},
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
  };
}

function shot(shotId: string, title: string) {
  return {
    shotId,
    title,
    storyBeat: `The beat for ${title}.`,
    narrativePurpose: `The purpose of ${title}.`,
    description: `The description for ${title}.`,
    shotType: 'Wide',
    subject: 'The subject',
    action: `The subject acts in ${title}.`,
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [],
    locationIds: [],
  };
}
