// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShotVideoTakeProductionPlanReport } from '@gorenku/studio-core/client';
import { SceneShotReferencesTab } from './scene-shot-references-tab';

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
}));

describe('SceneShotReferencesTab', () => {
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
  };
}

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
