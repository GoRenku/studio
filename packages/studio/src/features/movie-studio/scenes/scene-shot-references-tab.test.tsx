// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShotVideoTakeProductionPlanReport } from '@gorenku/studio-core/client';
import { SceneShotReferencesTab } from './scene-shot-references-tab';

vi.mock('@/services/studio-project-assets-api', () => ({
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
        productionPlan={productionPlanWithReferenceImages()}
        {...handlers}
      />
    );

    expect(
      screen.getByRole('img', { name: 'First frame' }).getAttribute('src')
    ).toBe('/shot-inputs/constantinople/scene_hook/input_first/file_first');
    expect(
      screen.getByRole('img', { name: 'Last frame' }).getAttribute('src')
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

  it('selects and deletes imported reference image takes from the shared card controls', async () => {
    const handlers = referenceHandlers();
    render(
      <SceneShotReferencesTab
        projectName='constantinople'
        sceneId='scene_hook'
        productionPlan={productionPlanWithReferenceImages()}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set Blade glint insert pick' }));
    await waitFor(() => {
      expect(handlers.onSelectInput).toHaveBeenCalledWith('input_blade');
    });

    fireEvent.click(screen.getAllByLabelText('Delete reference image')[0]!);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(handlers.onDeleteInput).toHaveBeenCalledWith('input_first');
    });
  });
});

function referenceHandlers() {
  return {
    onSelectInput: vi.fn(async () => undefined),
    onClearInput: vi.fn(async () => undefined),
    onDeleteInput: vi.fn(async () => undefined),
  };
}

function productionPlanWithReferenceImages(): ShotVideoTakeProductionPlanReport {
  return {
    imageReferences: [
      referenceChoice('first-frame', 'First frame', 'input_first', 'file_first'),
      referenceChoice('last-frame', 'Last frame', 'input_last', 'file_last'),
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
  } as ShotVideoTakeProductionPlanReport;
}

function referenceChoice(
  referenceKind:
    | 'first-frame'
    | 'last-frame'
    | 'reference-image'
    | 'multi-shot-storyboard-sheet',
  title: string,
  inputId: string,
  assetFileId: string,
  selected = true
): ShotVideoTakeProductionPlanReport['imageReferences'][number] {
  return {
    referenceKind,
    title,
    selected,
    image: {
      state: selected ? 'selected-ready' : 'available',
      mediaKind: 'image',
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
