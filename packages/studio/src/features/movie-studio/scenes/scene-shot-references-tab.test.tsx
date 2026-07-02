// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  SceneShotVideoTake,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import { idleSaveNotification } from '../detail-save-notification';
import { SceneShotReferencesTab } from './scene-shot-references-tab';

const mutationMocks = vi.hoisted(() => ({
  updateTakeCharacterSheetSelection: vi.fn(),
  updateTakeLocationSheetSelection: vi.fn(),
  updateShotGroupReferenceInclusion: vi.fn(),
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
      takeId: string,
      inputId: string,
      fileId: string
    ) => `/shot-inputs/${projectName}/${sceneId}/${takeId}/${inputId}/${fileId}`
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
  updateTakeCharacterSheetSelection:
    mutationMocks.updateTakeCharacterSheetSelection,
  updateTakeLocationSheetSelection:
    mutationMocks.updateTakeLocationSheetSelection,
  updateShotGroupReferenceInclusion:
    mutationMocks.updateShotGroupReferenceInclusion,
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
        productionPlan={withTake(productionPlanWithReferenceImages())}
        {...handlers}
      />
    );

    expect(screen.getByRole('button', { name: 'Collapse General' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Expand Lookbook' })).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Expand Cast Character Sheets' })
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Expand Location Sheets' })
    ).not.toBeNull();
    expect(
      screen.getByRole('img', { name: 'First Frame' }).getAttribute('src')
    ).toBe('/scene-assets/constantinople/scene_hook/asset_input_first/file_first');
    expect(
      screen.getByRole('img', { name: 'Last Frame' }).getAttribute('src')
    ).toBe('/scene-assets/constantinople/scene_hook/asset_input_last/file_last');
    expect(
      screen.getByRole('img', { name: 'Video Prompt Sheet (3 shots)' })
        .getAttribute('src')
    ).toBe('/scene-assets/constantinople/scene_hook/asset_input_storyboard/file_storyboard');
    expect(
      screen.getByRole('img', { name: 'Texture continuity' }).getAttribute('src')
    ).toBe('/scene-assets/constantinople/scene_hook/asset_input_texture/file_texture');
    expect(
      screen.getByRole('img', { name: 'Blade glint insert' }).getAttribute('src')
    ).toBe('/scene-assets/constantinople/scene_hook/asset_input_blade/file_blade');
  });

  it('shows inventory estimates for selected planned dependency references', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={productionPlanWithPlannedReferenceEstimate()}
        {...handlers}
      />
    );

    expect(screen.getByRole('heading', { name: 'Missing First Frame' })).toBeTruthy();
    expect(screen.getByText('$0.04')).toBeTruthy();
  });

  it('shows a planned Location Sheet placeholder with its estimate', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithPlannedLocationSheetEstimate())}
        {...handlers}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Theodosian Walls Location Sheet' })
    ).toBeTruthy();
    expect(screen.getByText('$0.04')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Theodosian Walls Location Sheet' })
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Select Theodosian Walls Location Sheet',
      })
    ).toBeNull();
  });

  it('does not show generation estimates for selected ready dependency references', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={productionPlanWithReadyReferenceEstimate()}
        {...handlers}
      />
    );

    expect(screen.getByRole('img', { name: 'Generated Character Sheet' })).toBeTruthy();
    expect(screen.queryByText('$0.04')).toBeNull();
  });

  it('includes and excludes reference images from the shared card controls', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithReferenceImages())}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Include Blade glint insert' }));
    await waitFor(() => {
      expect(mutationMocks.updateShotGroupReferenceInclusion).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          dependencyId: 'reference-image:input_blade',
          inclusion: 'include',
        }
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Exclude Texture continuity' }));
    await waitFor(() => {
      expect(mutationMocks.updateShotGroupReferenceInclusion).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          dependencyId: 'reference-image:input_texture',
          inclusion: 'exclude',
        }
      );
    });
  });

  it('reports reference save status around successful mutations', async () => {
    const mutation = deferredMutation();
    mutationMocks.updateShotGroupReferenceInclusion.mockReturnValueOnce(
      mutation.promise
    );
    const onSaveNotificationChange = vi.fn();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithReferenceImages())}
        onPlanRefresh={vi.fn(async () => undefined)}
        onSaveNotificationChange={onSaveNotificationChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Include Blade glint insert' }));

    await waitFor(() => {
      expect(onSaveNotificationChange).toHaveBeenCalledWith({
        state: 'saving',
        message: 'Saving',
      });
    });
    expect(onSaveNotificationChange).not.toHaveBeenCalledWith({
      state: 'saved',
      message: 'Saved',
    });

    mutation.resolve();

    await waitFor(() => {
      expect(onSaveNotificationChange).toHaveBeenCalledWith({
        state: 'saved',
        message: 'Saved',
      });
    });
  });

  it('clears reference save status when unmounted during a mutation', async () => {
    const mutation = deferredMutation();
    mutationMocks.updateShotGroupReferenceInclusion.mockReturnValueOnce(
      mutation.promise
    );
    const onSaveNotificationChange = vi.fn();
    const { unmount } = render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithReferenceImages())}
        onPlanRefresh={vi.fn(async () => undefined)}
        onSaveNotificationChange={onSaveNotificationChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Include Blade glint insert' }));

    await waitFor(() => {
      expect(onSaveNotificationChange).toHaveBeenCalledWith({
        state: 'saving',
        message: 'Saving',
      });
    });

    unmount();

    expect(onSaveNotificationChange).toHaveBeenLastCalledWith(
      idleSaveNotification
    );
    mutation.resolve();
  });

  it('updates reference inclusion across the Shot Video Take for multi-shot plans', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={{
          ...productionPlanWithReferenceImages(),
          take: {
            takeId: 'take_001',
            sceneId: 'scene_hook',
            sourceShotListId: 'shot_list_hook',
            shotIds: ['shot_001', 'shot_002'],
            title: 'Shot Video Take',
            picked: false,
            video: null,
            state: emptyTakeState(),
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
        }}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Include Blade glint insert' }));
    await waitFor(() => {
      expect(mutationMocks.updateShotGroupReferenceInclusion).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          dependencyId: 'reference-image:input_blade',
          inclusion: 'include',
        }
    );
  });

  });

  it('renders dependency inventory diagnostics in Reference issues', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={{
          ...productionPlanWithReferenceImages(),
          diagnostics: [
            {
              severity: 'error',
              code: 'CORE_MEDIA_DEPENDENCY_ENVIRONMENT_SHEET_METADATA_MISSING',
              message: 'Selected location environment sheet is missing metadata.',
            },
          ],
        } as ShotVideoTakeProductionPlanReport}
        {...handlers}
      />
    );

    expect(screen.getByText('Reference issues')).toBeTruthy();
    expect(
      screen.getByText('Selected location environment sheet is missing metadata.')
    ).toBeTruthy();
  });

  it('renders one cast card and selects alternate character sheets from a dialog', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithCastReferences())}
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
      expect(mutationMocks.updateTakeCharacterSheetSelection).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          castMemberId: 'cast_urban',
          assetId: 'asset_urban-2',
        }
      );
    });
  });

  it('references Location Sheets using the shot persistence API', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithLocationReferences())}
        {...handlers}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Select Theodosian Walls Location Sheet',
      })
    );

    await waitFor(() => {
      expect(mutationMocks.updateTakeLocationSheetSelection).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          locationId: 'location_walls',
          assetId: 'asset_walls_sheet',
        }
      );
    });
  });

  it('opens a single Location Sheet in the shared image preview dialog', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithLocationReferences())}
        {...handlers}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Theodosian Walls Location Sheet' })
    );

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog)
        .getByRole('img', { name: 'Theodosian Walls location sheet' })
        .getAttribute('src')
    ).toBe('/location-assets/constantinople/location_walls/walls-sheet/file_walls-sheet');
  });

  it('opens a Location Sheet picker for multiple sheets and previews dialog cards', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={withTake(productionPlanWithMultipleLocationReferences())}
        {...handlers}
      />
    );

    expect(screen.getByRole('heading', { name: 'Theodosian Walls' })).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Night Repair Location Sheet' })
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Theodosian Walls' }));

    const pickerDialog = screen.getByRole('dialog');
    expect(
      within(pickerDialog).getByRole('heading', {
        name: 'Siege-Facing Location Sheet',
      })
    ).toBeTruthy();
    expect(
      within(pickerDialog).getByRole('heading', {
        name: 'Night Repair Location Sheet',
      })
    ).toBeTruthy();

    fireEvent.click(
      within(pickerDialog).getByRole('button', {
        name: 'Select Night Repair Location Sheet',
      })
    );

    await waitFor(() => {
      expect(mutationMocks.updateTakeLocationSheetSelection).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          locationId: 'location_walls',
          assetId: 'asset_walls_night',
        }
      );
    });

    fireEvent.click(
      within(pickerDialog).getByRole('button', {
        name: 'Night Repair Location Sheet',
      })
    );

    expect(
      screen.getByRole('dialog', { name: 'Night repair location sheet' })
    ).toBeTruthy();
  });
});

function referenceHandlers() {
  return {
    onPlanRefresh: vi.fn(async () => undefined),
  };
}

function deferredMutation() {
  let resolve: (value: typeof SCENE_SHOT_LIST_RESOURCE) => void = () => {};
  const promise = new Promise<typeof SCENE_SHOT_LIST_RESOURCE>((settle) => {
    resolve = settle;
  });
  return {
    promise,
    resolve: () => resolve(SCENE_SHOT_LIST_RESOURCE),
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
          'video-prompt-sheet',
          'Video Prompt Sheet (3 shots)',
          'input_storyboard',
          'file_storyboard'
        ),
        referenceChoice(
          'reference-image',
          'Texture continuity',
          'input_texture',
          'file_texture',
          true,
          'reference-image:input_texture'
        ),
        referenceChoice(
          'reference-image',
          'Blade glint insert',
          'input_blade',
          'file_blade',
          false,
          'reference-image:input_blade'
        ),
      ],
      lookbook: [],
      castMembers: [],
      locations: [],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function withTake(
  report: ShotVideoTakeProductionPlanReport
): ShotVideoTakeProductionPlanReport {
  return {
    ...report,
    take: makeTake(),
  };
}

function makeTake(): SceneShotVideoTake {
  return {
    takeId: 'take_001',
    sceneId: 'scene_hook',
    sourceShotListId: 'shot_list_hook',
    shotIds: ['shot_001'],
    title: 'Shot Video Take',
    picked: false,
    video: null,
    state: emptyTakeState(),
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
  };
}

function productionPlanWithPlannedReferenceEstimate(): ShotVideoTakeProductionPlanReport {
  return {
    references: {
      general: [
        {
          id: 'first-frame:shot:shot_001',
          kind: 'first-frame',
          title: 'Missing First Frame',
          selected: true,
          clearInputSlot: {
            kind: 'first-frame',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
          card: {
            state: 'selected-planned',
            mediaKind: 'image',
            dependencyId: 'first-frame:shot:shot_001',
            dependencyLineId: 'dependency-line:first-frame:shot:shot_001',
            defaultIncluded: true,
            included: true,
            required: true,
            inclusionOverride: null,
            pricing: { state: 'priced', estimatedUsd: 0.04 },
            previews: [],
            diagnostics: [],
          },
        },
      ],
      lookbook: [],
      castMembers: [],
      locations: [],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function productionPlanWithReadyReferenceEstimate(): ShotVideoTakeProductionPlanReport {
  return {
    references: {
      general: [
        {
          id: 'character-sheet:cast:urban',
          kind: 'reference-image',
          title: 'Generated Character Sheet',
          selected: true,
          clearInputSlot: {
            kind: 'reference-image',
            subjectKind: 'cast-member',
            subjectId: 'cast_urban',
          },
          card: {
            state: 'selected-ready',
            mediaKind: 'image',
            dependencyId: 'cast-character-sheet:cast_urban',
            dependencyLineId: 'dependency:cast-character-sheet:cast_urban',
            defaultIncluded: true,
            included: true,
            required: false,
            inclusionOverride: null,
            pricing: { state: 'priced', estimatedUsd: 0 },
            previews: [
              {
                inputId: 'input_character_sheet',
                assetId: 'asset_character_sheet',
                assetFileId: 'file_character_sheet',
                projectRelativePath: 'generated/character-sheet.png' as never,
                title: 'Generated Character Sheet',
                alt: 'Generated Character Sheet',
              },
            ],
            diagnostics: [],
          },
        },
      ],
      lookbook: [],
      castMembers: [],
      locations: [],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function productionPlanWithPlannedLocationSheetEstimate(): ShotVideoTakeProductionPlanReport {
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
          selectedLocationSheetAssetId: null,
          diagnostics: [],
          environmentSheets: [
            {
              id: 'location_walls:planned-environment-sheet',
              locationId: 'location_walls',
              assetId: null,
              title: 'Theodosian Walls Location Sheet',
              description: null,
              selected: true,
              card: {
                state: 'selected-planned',
                mediaKind: 'image',
                dependencyId: 'location-environment-sheet:location_walls',
                dependencyLineId: 'dependency:location-environment-sheet:location_walls',
                defaultIncluded: true,
                included: true,
                required: false,
                inclusionOverride: null,
                pricing: { state: 'priced', estimatedUsd: 0.04 },
                previews: [],
                diagnostics: [],
              },
            },
          ],
        },
      ],
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
          selectedLocationSheetAssetId: null,
          diagnostics: [],
          environmentSheets: [
            {
              id: 'asset_walls_sheet',
              locationId: 'location_walls',
              assetId: 'asset_walls_sheet',
              title: 'Theodosian Walls Location Sheet',
              description: 'Siege-facing walls and approach field reference.',
              selected: false,
              card: referenceCard('walls-sheet', 'Theodosian Walls location sheet'),
            },
          ],
        },
      ],
    },
    diagnostics: [],
  } as unknown as ShotVideoTakeProductionPlanReport;
}

function productionPlanWithMultipleLocationReferences(): ShotVideoTakeProductionPlanReport {
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
          selectedLocationSheetAssetId: 'asset_walls_siege',
          diagnostics: [],
          environmentSheets: [
            {
              id: 'asset_walls_siege',
              locationId: 'location_walls',
              assetId: 'asset_walls_siege',
              title: 'Siege-Facing Location Sheet',
              description: 'Ottoman field, wall face, and city depth.',
              selected: true,
              card: referenceCard(
                'asset_walls_siege',
                'Siege-facing location sheet'
              ),
            },
            {
              id: 'asset_walls_night',
              locationId: 'location_walls',
              assetId: 'asset_walls_night',
              title: 'Night Repair Location Sheet',
              description: 'Torch-lit wall repair texture and damaged masonry.',
              selected: false,
              card: referenceCard(
                'asset_walls_night',
                'Night repair location sheet'
              ),
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
      dependencyId: 'cast-character-sheet:cast_urban',
      dependencyLineId: 'dependency:cast-character-sheet:cast_urban',
      defaultIncluded: true,
      included: true,
      required: false,
      inclusionOverride: null,
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
    dependencyId: assetId,
    dependencyLineId: `dependency:${assetId}`,
    defaultIncluded: true,
    included: true,
    required: false,
    inclusionOverride: null,
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
    | 'video-prompt-sheet',
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
    clearInputSlot: selected
      ? {
          kind,
          subjectKind: 'shot',
          subjectId: 'shot_001',
        }
      : null,
    card: {
      state: selected ? 'selected-ready' : 'available',
      mediaKind: 'image',
      ...(dependencyId ? { dependencyId } : {}),
      defaultIncluded: selected,
      included: selected,
      required: kind === 'first-frame' || kind === 'last-frame',
      inclusionOverride: null,
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

function emptyTakeState() {
  return {
    version: 2 as const,
    structure: {
      mode: 'continuous' as const,
      sharedDirection: {
        referenceSelections: {
          dependencyInclusions: {},
          selectedCharacterSheetAssetIds: {},
          selectedLocationSheetAssetIds: {},
          selectedLookbookSheetIds: [],
          selectedDialogueAudioTakeIds: {},
        },
      },
    },
    production: {},
  };
}
