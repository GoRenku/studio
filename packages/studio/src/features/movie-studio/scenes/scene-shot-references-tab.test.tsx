// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import type { ShotVideoTakeWorkspaceResponse } from '@/services/studio-shot-video-takes-api';
import { SceneShotReferencesTab } from './scene-shot-references-tab';

vi.mock('@/features/image-revision/use-image-revision-dialog', () => ({
  useImageRevisionDialog: () => ({ openImageRevision: vi.fn() }),
}));

describe('SceneShotReferencesTab', () => {
  it('preserves General, Lookbook, Cast, and Location order', () => {
    renderTab();
    const sectionTitles = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((label): label is string => Boolean(label?.match(/^(Collapse|Expand) /)))
      .map((label) => label.replace(/^(Collapse|Expand) /, ''));
    expect(sectionTitles.slice(0, 4)).toEqual([
      'General',
      'Lookbook',
      'Cast Character Sheets',
      'Location Sheets',
    ]);
  });

  it('renders exact ready reference media without candidate pricing', () => {
    renderTab();
    expect(screen.getByRole('img', { name: 'First Frame' })).toBeTruthy();
    expect(screen.queryByText(/\$\d/)).toBeNull();
    expect(screen.queryByText(/Estimated/i)).toBeNull();
  });

  it('persists include and exclude intent through the selection id', async () => {
    const onSetReference = vi.fn().mockResolvedValue(undefined);
    renderTab({ onSetReference });

    fireEvent.click(
      screen.getByRole('button', { name: /Exclude First Frame/i })
    );
    await waitFor(() =>
      expect(onSetReference).toHaveBeenCalledWith(
        'selection_first_frame',
        false
      )
    );
  });

  it('preserves image preview behavior', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'First Frame' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'First Frame' })).toBeTruthy();
  });

  it('keeps guide notices separate from reference cards', () => {
    renderTab({
      diagnostics: [
        {
          code: 'CORE_GENERATION_SHOT_REFERENCES_RECOMMENDED',
          message: 'Add a general reference for consistency.',
        },
      ],
    });
    expect(screen.getByText('Reference issues')).toBeTruthy();
    expect(
      screen.getByText('Add a general reference for consistency.')
    ).toBeTruthy();
  });

  it('reports save feedback for exact reference mutations', async () => {
    const onSaveNotificationChange = vi.fn();
    const onSetReference = vi.fn().mockResolvedValue(undefined);
    renderTab({ onSaveNotificationChange, onSetReference });

    fireEvent.click(
      screen.getByRole('button', { name: /Exclude First Frame/i })
    );
    await waitFor(() =>
      expect(onSaveNotificationChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'saved' })
      )
    );
  });
});

function renderTab(overrides: {
  onSetReference?: (selectionId: string, included: boolean) => Promise<void>;
  onSaveNotificationChange?: ReturnType<typeof vi.fn>;
  diagnostics?: Array<{ code: string; message: string }>;
} = {}) {
  return render(
    <SceneShotReferencesTab
      projectName='constantinople'
      sceneId='scene_001'
      take={take()}
      references={references()}
      diagnostics={overrides.diagnostics}
      onSetReference={overrides.onSetReference ?? vi.fn().mockResolvedValue(undefined)}
      onSaveNotificationChange={overrides.onSaveNotificationChange}
    />
  );
}

function take(): SceneShotVideoTake {
  return {
    takeId: 'take_001',
    sceneId: 'scene_001',
    sourceShotListId: 'shot_list_001',
    title: 'Take 1',
    shotIds: ['shot_001'],
    picked: false,
    video: null,
    state: {
      version: 3,
      structure: { mode: 'continuous', sharedDirection: {} },
    },
    status: {
      editability: {
        state: 'editable',
        diagnostics: [],
        message: 'This take is editable.',
      },
      resolvability: {
        state: 'resolvable',
        diagnostics: [],
        message: 'All references resolve.',
      },
      archive: { state: 'active', message: 'This take is active.' },
      history: { differences: [], message: 'No differences.' },
    },
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  };
}

function references(): ShotVideoTakeWorkspaceResponse['generation']['references'] {
  const card = {
    state: 'selected-ready' as const,
    selectionId: 'selection_first_frame',
    defaultIncluded: true,
    included: true,
    required: false,
    previews: [{
      selectionId: 'selection_first_frame',
      assetId: 'asset_first_frame',
      assetFileId: 'file_first_frame',
      projectRelativePath: 'generated/media/first-frame.png',
      title: 'First Frame',
      alt: 'First Frame',
      url: '/studio-api/projects/constantinople/assets/asset_first_frame/files/file_first_frame',
    }],
    diagnostics: [],
  };
  return {
    general: [{
      id: 'selection_first_frame',
      kind: 'first-frame',
      title: 'First Frame',
      selected: true,
      card,
    }],
    lookbook: [],
    dialogueAudio: [],
    dialogueAudioCapability: {
      state: 'unsupported',
      supported: false,
      selectedCount: 0,
      maxCount: null,
      modelLabel: 'Seedance 2.0',
      message: 'This model does not use audio references.',
      diagnostics: [],
    },
    castMembers: [],
    locations: [],
  } as unknown as ShotVideoTakeWorkspaceResponse['generation']['references'];
}
