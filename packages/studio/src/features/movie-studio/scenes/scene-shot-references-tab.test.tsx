// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShotVideoTakeProductionPlanReport } from '@gorenku/studio-core/client';
import { SceneShotReferencesTab } from './scene-shot-references-tab';

const mutationMocks = vi.hoisted(() => ({
  updateShotCastCharacterSheetReference: vi.fn(),
  updateShotCastReferences: vi.fn(),
  updateShotLocationReference: vi.fn(),
  updateShotLocationViewReferences: vi.fn(),
  updateShotLookbookReference: vi.fn(),
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  castAssetFileUrl: vi.fn(
    (
      projectName: string,
      castMemberId: string,
      assetId: string,
      fileId: string
    ) => `/cast-assets/${projectName}/${castMemberId}/${assetId}/${fileId}`
  ),
  sceneAssetFileUrl: vi.fn(
    (
      projectName: string,
      sceneId: string,
      assetId: string,
      fileId: string
    ) => `/scene-assets/${projectName}/${sceneId}/${assetId}/${fileId}`
  ),
  shotVideoTakeInputFileUrl: vi.fn(
    (
      projectName: string,
      sceneId: string,
      inputId: string,
      fileId: string
    ) => `/shot-inputs/${projectName}/${sceneId}/${inputId}/${fileId}`
  ),
  locationAssetFileUrl: vi.fn(
    (
      projectName: string,
      locationId: string,
      assetId: string,
      fileId: string
    ) => `/location-assets/${projectName}/${locationId}/${assetId}/${fileId}`
  ),
}));

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  updateShotCastCharacterSheetReference:
    mutationMocks.updateShotCastCharacterSheetReference,
  updateShotCastReferences: mutationMocks.updateShotCastReferences,
  updateShotLocationReference: mutationMocks.updateShotLocationReference,
  updateShotLocationViewReferences:
    mutationMocks.updateShotLocationViewReferences,
  updateShotLookbookReference: mutationMocks.updateShotLookbookReference,
}));

describe('SceneShotReferencesTab', () => {
  beforeEach(() => {
    for (const mock of Object.values(mutationMocks)) {
      mock.mockResolvedValue({ resource: SCENE_SHOT_LIST_RESOURCE });
      mock.mockClear();
    }
  });

  it('renders generated shot dependency images as reference cards', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        productionPlan={productionPlanWithReferenceImages()}
        {...handlers}
      />
    );

    expect(screen.getByRole('button', { name: 'Collapse General' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Expand Lookbook' })).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Expand Cast Character Sheets' })
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Expand Location Sheets And Views' })
    ).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'First Frame' }).getAttribute('src')
    ).toBe('/shot-inputs/constantinople/scene_hook/input_first/file_first');
    expect(
      screen.getByRole('img', { name: 'Last Frame' }).getAttribute('src')
    ).toBe('/shot-inputs/constantinople/scene_hook/input_last/file_last');
    expect(
      screen.getByRole('img', { name: 'Storyboard sheet (3 shots)' })
        .getAttribute('src')
    ).toBe('/shot-inputs/constantinople/scene_hook/input_storyboard/file_storyboard');
    expect(
      screen.getByRole('img', { name: 'Texture continuity' }).getAttribute('src')
    ).toBe('/shot-inputs/constantinople/scene_hook/input_texture/file_texture');
    expect(
      screen.getByRole('img', { name: 'Blade glint insert' }).getAttribute('src')
    ).toBe('/shot-inputs/constantinople/scene_hook/input_blade/file_blade');
  });

  it('selects and clears imported reference image takes from the shared card controls', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        productionPlan={productionPlanWithReferenceImages()}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Blade glint insert pick' }));
    await waitFor(() => {
      expect(handlers.onSelectInput).toHaveBeenCalledWith('input_blade');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear First Frame pick' }));
    await waitFor(() => {
      expect(handlers.onClearInput).toHaveBeenCalledWith({
        kind: 'first-frame',
        subjectKind: 'shot',
        subjectId: 'shot_001',
      });
    });
  });

  it('renders one cast card and selects alternate character sheets from a dialog', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        productionPlan={productionPlanWithCastReferences()}
        {...handlers}
      />
    );

    expect(screen.getAllByRole('heading', { name: 'Urban' }).length).toBe(1);
    expect(screen.queryByRole('heading', { name: /^Urban Character/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Urban Character Sheet/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Urban' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Urban' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Sheet 1' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Sheet 2' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Set Sheet 2 pick' }));

    await waitFor(() => {
      expect(mutationMocks.updateShotCastCharacterSheetReference).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'shot_001',
        {
          castMemberId: 'cast_urban',
          assetId: 'asset_urban-2',
        }
      );
    });
  });

  it('selects location views from the location dialog using the shot persistence API', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        productionPlan={productionPlanWithLocationReferences()}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Theodosian Walls' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Theodosian Walls' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Set Front pick' }));

    await waitFor(() => {
      expect(mutationMocks.updateShotLocationViewReferences).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'shot_001',
        {
          locationId: 'location_walls',
          assetId: 'asset_walls_sheet',
          viewIds: ['front'],
        }
      );
    });
  });
});

const SHOT = {
  shotId: 'shot_001',
  title: 'Map study',
  storyBeat: 'beat',
  narrativePurpose: 'purpose',
  description: 'description',
  shotType: 'wide',
  subject: 'subject',
  action: 'action',
  dialogue: [],
  coveredBlockIndexes: [0],
  castMemberIds: [],
  locationIds: [],
};

function referenceHandlers() {
  return {
    onSelectInput: vi.fn(async () => undefined),
    onClearInput: vi.fn(async () => undefined),
    onResourceRefreshed: vi.fn(),
    onPlanRefresh: vi.fn(async () => undefined),
  };
}

const SCENE_SHOT_LIST_RESOURCE = {
  projectName: 'constantinople',
  sceneId: 'scene_hook',
  scenes: [],
};

function productionPlanWithReferenceImages(): ShotVideoTakeProductionPlanReport {
  return {
    references: {
      general: [
        referenceChoice(
          'first-frame',
          'First Frame',
          'input_first',
          'file_first',
          true,
          'first-frame:shot:shot_001'
        ),
        referenceChoice('last-frame', 'Last Frame', 'input_last', 'file_last'),
        referenceChoice(
          'multi-shot-storyboard-sheet',
          'Storyboard sheet (3 shots)',
          'input_storyboard',
          'file_storyboard'
        ),
        referenceChoice(
          'reference-image',
          'Texture continuity',
          'input_texture',
          'file_texture'
        ),
        referenceChoice(
          'reference-image',
          'Blade glint insert',
          'input_blade',
          'file_blade',
          false
        ),
      ],
      lookbook: [],
      castMembers: [],
      locations: [],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function productionPlanWithCastReferences(): ShotVideoTakeProductionPlanReport {
  return {
    references: {
      general: [],
      lookbook: [],
      castMembers: [
        {
          castMemberId: 'cast_urban',
          name: 'Urban',
          role: 'protagonist',
          selectedForShot: true,
          defaultSelectedForShot: true,
          selectedCharacterSheetAssetId: 'asset_urban_1',
          defaultCharacterSheetAssetId: 'asset_urban_1',
          diagnostics: [],
          characterSheets: [
            characterSheetChoice('urban-1', 'Urban Character Sheet', 'file_urban_1', true),
            characterSheetChoice('urban-2', 'Urban Character Sheet 2', 'file_urban_2', false),
          ],
        },
      ],
      locations: [],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function productionPlanWithLocationReferences(): ShotVideoTakeProductionPlanReport {
  return {
    references: {
      general: [],
      lookbook: [],
      castMembers: [],
      locations: [
        {
          locationId: 'location_walls',
          name: 'Theodosian Walls',
          selectedForShot: true,
          defaultSelectedForShot: true,
          selectedEnvironmentSheetAssetId: 'asset_walls_sheet',
          defaultEnvironmentSheetAssetId: 'asset_walls_sheet',
          selectedViewIds: [],
          diagnostics: [],
          environmentSheets: [
            {
              id: 'asset_walls_sheet',
              locationId: 'location_walls',
              assetId: 'asset_walls_sheet',
              title: 'Theodosian Walls Location Sheet',
              selected: true,
              defaultSelected: true,
              card: referenceCard('walls-sheet', 'Theodosian Walls location sheet'),
              views: [
                {
                  id: 'front',
                  viewId: 'front',
                  label: 'Front',
                  selected: false,
                  card: referenceCard('walls-front', 'Front'),
                },
                {
                  id: 'right',
                  viewId: 'right',
                  label: 'Right',
                  selected: false,
                  card: referenceCard('walls-right', 'Right'),
                },
              ],
            },
          ],
        },
      ],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function characterSheetChoice(
  id: string,
  title: string,
  assetFileId: string,
  selected: boolean
) {
  return {
    id,
    castMemberId: 'cast_urban',
    assetId: `asset_${id}`,
    title,
    selected,
    defaultSelected: selected,
    card: {
      state: selected ? 'selected-ready' : 'available',
      mediaKind: 'image',
      pricing: { state: 'not-applicable', estimatedUsd: null },
      previews: [
        {
          assetId: `asset_${id}`,
          assetFileId,
          projectRelativePath: `generated/${assetFileId}.png` as never,
          title,
          alt: title,
        },
      ],
      diagnostics: [],
    },
  };
}

function referenceCard(assetId: string, title: string) {
  return {
    state: 'selected-ready',
    mediaKind: 'image',
    pricing: { state: 'not-applicable', estimatedUsd: null },
    previews: [
      {
        assetId,
        assetFileId: `file_${assetId}`,
        projectRelativePath: `generated/${assetId}.png` as never,
        title,
        alt: title,
      },
    ],
    diagnostics: [],
  };
}

function referenceChoice(
  kind:
    | 'first-frame'
    | 'last-frame'
    | 'reference-image'
    | 'multi-shot-storyboard-sheet',
  title: string,
  inputId: string,
  assetFileId: string,
  selected = true,
  dependencyId?: string
): ShotVideoTakeProductionPlanReport['references']['general'][number] {
  return {
    id: inputId,
    kind,
    title,
    selected,
    card: {
      state: selected ? 'selected-ready' : 'available',
      mediaKind: 'image',
      ...(dependencyId ? { dependencyId } : {}),
      pricing: { state: 'not-applicable', estimatedUsd: null },
      previews: [
        {
          inputId,
          assetId: `asset_${inputId}`,
          assetFileId,
          projectRelativePath: `generated/${assetFileId}.png` as never,
          title,
          alt: title,
        },
      ],
      diagnostics: [],
    },
  };
}
