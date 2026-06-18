// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShotVideoTakeProductionPlanReport } from '@gorenku/studio-core/client';
import { SceneShotReferencesTab } from './scene-shot-references-tab';

const mutationMocks = vi.hoisted(() => ({
  updateShotCastCharacterSheetReference: vi.fn(),
  updateShotLocationViewReferences: vi.fn(),
  updateShotGroupReferenceInclusion: vi.fn(),
  updateShotReferenceInclusion: vi.fn(),
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
  updateShotCastCharacterSheetReference:
    mutationMocks.updateShotCastCharacterSheetReference,
  updateShotLocationViewReferences:
    mutationMocks.updateShotLocationViewReferences,
  updateShotGroupReferenceInclusion:
    mutationMocks.updateShotGroupReferenceInclusion,
  updateShotReferenceInclusion: mutationMocks.updateShotReferenceInclusion,
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
    ).toBe('/scene-assets/constantinople/scene_hook/asset_input_first/file_first');
    expect(
      screen.getByRole('img', { name: 'Last Frame' }).getAttribute('src')
    ).toBe('/scene-assets/constantinople/scene_hook/asset_input_last/file_last');
    expect(
      screen.getByRole('img', { name: 'Multi-Shot Storyboard Reference (3 shots)' })
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
        shot={SHOT}
        productionPlan={productionPlanWithPlannedReferenceEstimate()}
        {...handlers}
      />
    );

    expect(screen.getByRole('heading', { name: 'Missing First Frame' })).toBeTruthy();
    expect(screen.getByText('$0.04')).toBeTruthy();
  });

  it('does not show generation estimates for selected ready dependency references', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
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
        shot={SHOT}
        productionPlan={productionPlanWithReferenceImages()}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Include Blade glint insert' }));
    await waitFor(() => {
      expect(mutationMocks.updateShotReferenceInclusion).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'shot_001',
        {
          dependencyId: 'reference-image:input_blade',
          inclusion: 'include',
        }
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Exclude Texture continuity' }));
    await waitFor(() => {
      expect(mutationMocks.updateShotReferenceInclusion).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'shot_001',
        {
          dependencyId: 'reference-image:input_texture',
          inclusion: 'exclude',
        }
      );
    });
  });

  it('updates reference inclusion across the take generation for multi-shot plans', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
        productionPlan={{
          ...productionPlanWithReferenceImages(),
          take: {
            takeId: 'take_generation_001',
            sceneId: 'scene_hook',
            shotListId: 'shot_list_hook',
            shotIds: ['shot_001', 'shot_002'],
            title: 'Take generation',
            state: emptyTakeState(),
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
        }}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Include Blade glint insert' }));
    await waitFor(() => {
      expect(mutationMocks.updateShotGroupReferenceInclusion).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_generation_001',
        {
          dependencyId: 'reference-image:input_blade',
          inclusion: 'include',
        }
    );
  });

    expect(mutationMocks.updateShotReferenceInclusion).not.toHaveBeenCalled();
  });

  it('renders dependency inventory diagnostics in Reference issues', () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        shot={SHOT}
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
          'Multi-Shot Storyboard Reference (3 shots)',
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
    version: 1 as const,
    shotDesignByShotId: {},
    referenceSelections: {
      dependencyInclusions: {},
      selectedCharacterSheetAssetIds: {},
      selectedLocationSheetAssetIds: {},
      selectedLocationViewIds: {},
      selectedLookbookSheetIds: [],
      selectedDialogueAudioTakeIds: {},
    },
    production: {},
  };
}
