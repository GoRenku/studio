// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Lookbook,
  LookbookImage,
  LookbookResource,
  LookbookSheet,
} from '@gorenku/studio-core/client';
import {
  deleteLookbookImage,
  deleteLookbookSheet,
  readLookbook,
  setDefaultLookbookSheet,
  selectLookbookForType,
} from '@/services/studio-visual-language-api';
import { LookbookPanel } from './lookbook-panel';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-visual-language-api', () => ({
  deleteLookbookImage: vi.fn(),
  deleteLookbookSheet: vi.fn(),
  readLookbook: vi.fn(),
  setDefaultLookbookSheet: vi.fn(),
  selectLookbookForType: vi.fn(),
}));

describe('LookbookPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteLookbookImage).mockReset();
    vi.mocked(deleteLookbookSheet).mockReset();
    vi.mocked(readLookbook).mockReset();
    vi.mocked(setDefaultLookbookSheet).mockReset();
    vi.mocked(selectLookbookForType).mockReset();
  });

  it('refreshes the open Lookbook when a Studio resource event reports an imported image', async () => {
    vi.mocked(readLookbook)
      .mockResolvedValueOnce(lookbookResource('Original lookbook'))
      .mockResolvedValueOnce(lookbookResource('Updated lookbook'));

    render(
      <LookbookPanel
        projectName='constantinople'
        lookbookId='lookbook_test0001'
        onLookbooksChange={vi.fn()}
      />
    );

    expect(await screen.findByText('Original lookbook')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople',
            resourceKeys: ['surface:visual-language:lookbook:lookbook_test0001'],
          },
        })
      );
    });

    await waitFor(() => {
      expect(vi.mocked(readLookbook)).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Updated lookbook')).not.toBeNull();
  });

  it('deletes a Lookbook image after confirmation', async () => {
    const onLookbooksChange = vi.fn();
    vi.mocked(deleteLookbookImage).mockResolvedValue();
    vi.mocked(readLookbook)
      .mockResolvedValueOnce(lookbookResource('Original lookbook'))
      .mockResolvedValueOnce(lookbookResource('Original lookbook', false));

    render(
      <LookbookPanel
        projectName='constantinople'
        lookbookId='lookbook_test0001'
        onLookbooksChange={onLookbooksChange}
      />
    );

    await openVisualContentTab();
    expect(await screen.findByAltText('Palette frame')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Delete image'));
    expect(screen.getByText('Delete Image?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteLookbookImage).toHaveBeenCalledWith(
        'constantinople',
        'lookbook_image_test0001'
      );
    });
    await waitFor(() => {
      expect(onLookbooksChange).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByAltText('Palette frame')).toBeNull();
  });

  it('deletes a Lookbook sheet after confirmation', async () => {
    const onLookbooksChange = vi.fn();
    vi.mocked(deleteLookbookSheet).mockResolvedValue();
    vi.mocked(readLookbook)
      .mockResolvedValueOnce(lookbookResource('Original lookbook', true, true))
      .mockResolvedValueOnce(lookbookResource('Original lookbook', true, false));

    render(
      <LookbookPanel
        projectName='constantinople'
        lookbookId='lookbook_test0001'
        onLookbooksChange={onLookbooksChange}
      />
    );

    await openVisualContentTab();
    expect(await screen.findByAltText('Default lookbook sheet')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Delete lookbook sheet'));
    expect(screen.getByText('Delete Lookbook Sheet?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteLookbookSheet).toHaveBeenCalledWith(
        'constantinople',
        'lookbook_sheet_test0001'
      );
    });
    await waitFor(() => {
      expect(onLookbooksChange).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByAltText('Default lookbook sheet')).toBeNull();
  });

  it('sets a different Lookbook sheet as the default sheet', async () => {
    const onLookbooksChange = vi.fn();
    vi.mocked(setDefaultLookbookSheet).mockResolvedValue(
      lookbookSheet('lookbook_sheet_test0002')
    );
    vi.mocked(readLookbook)
      .mockResolvedValueOnce(
        lookbookResource('Original lookbook', true, true, [
          lookbookSheet('lookbook_sheet_test0001'),
          lookbookSheet('lookbook_sheet_test0002'),
        ])
      )
      .mockResolvedValueOnce(
        lookbookResource('Original lookbook', true, true, [
          lookbookSheet('lookbook_sheet_test0002'),
          lookbookSheet('lookbook_sheet_test0001'),
        ])
      );

    render(
      <LookbookPanel
        projectName='constantinople'
        lookbookId='lookbook_test0001'
        onLookbooksChange={onLookbooksChange}
      />
    );

    await openVisualContentTab();
    const setDefaultButtons = await screen.findAllByRole('button', {
      name: 'Set default lookbook sheet',
    });
    fireEvent.click(setDefaultButtons[0]!);

    await waitFor(() => {
      expect(setDefaultLookbookSheet).toHaveBeenCalledWith(
        'constantinople',
        'lookbook_sheet_test0002'
      );
    });
    expect(onLookbooksChange).toHaveBeenCalledTimes(1);
  });
});

async function openVisualContentTab() {
  const visualContentTab = await screen.findByRole('tab', {
    name: 'Visual Content',
  });
  fireEvent.pointerDown(visualContentTab, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(visualContentTab);
  fireEvent.mouseDown(visualContentTab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(visualContentTab);
  fireEvent.click(visualContentTab);
}

function lookbookResource(
  name: string,
  includeImage = true,
  includeSheets = false,
  sheets = includeSheets ? [lookbookSheet('lookbook_sheet_test0001')] : []
): LookbookResource {
  const paletteImage = lookbookImage();
  return {
    valid: true,
    warnings: [],
    project: { name: 'constantinople' },
    resourceKeys: [],
    lookbook: lookbook(name),
    sourceInspirationFolders: [],
    cardImage: null,
    isSelectedForType: false,
    sheets,
    images: includeImage ? [paletteImage] : [],
    imagesBySection: {
      thesis: [],
      palette: includeImage ? [paletteImage] : [],
      toneMood: [],
      composition: [],
      lighting: [],
      texture: [],
      camera: [],
      styleBrief: [],
      lineAndFinish: [],
      valueAndAccent: [],
      panelAndNotation: [],
      continuityAndClarity: [],
      guardrails: [],
    },
  };
}

function lookbookImage(): LookbookImage {
  return {
    id: 'lookbook_image_test0001',
    lookbookId: 'lookbook_test0001',
    lookbookType: 'movie',
    sections: ['palette'],
    asset: {
      assetId: 'asset_test0001',
      type: 'lookbook_image',
      mediaKind: 'image',
      title: 'Palette frame',
      oneLineSummary: 'Muted color frame.',
      origin: 'generated',
      availability: 'available',
      createdAt: '2026-05-25T00:00:00.000Z',
      updatedAt: '2026-05-25T00:00:00.000Z',
      files: [
        {
          id: 'asset_file_test0001',
          role: 'primary',
          mediaKind: 'image',
          projectRelativePath: 'visual-language/lookbook/palette-frame.png' as never,
          mimeType: 'image/png',
          sizeBytes: 123,
          contentHash: null,
          width: 1280,
          height: 720,
          durationSeconds: null,
        },
      ],
    },
  };
}

function lookbookSheet(id: string): LookbookSheet {
  return {
    id,
    lookbookId: 'lookbook_test0001',
    lookbookType: 'movie',
    asset: {
      assetId: `asset_${id}`,
      type: 'lookbook_sheet',
      mediaKind: 'image',
      title: 'Lookbook sheet',
      oneLineSummary: 'A generated lookbook sheet.',
      origin: 'generated',
      availability: 'available',
      createdAt: '2026-05-25T00:00:00.000Z',
      updatedAt: '2026-05-25T00:00:00.000Z',
      files: [
        {
          id: `asset_file_${id}`,
          role: 'primary',
          mediaKind: 'image',
          projectRelativePath: 'visual-language/lookbook/lookbook-sheet.png' as never,
          mimeType: 'image/png',
          sizeBytes: 123,
          contentHash: null,
          width: 1024,
          height: 768,
          durationSeconds: null,
        },
      ],
    },
  };
}

function lookbook(name: string): Lookbook {
  return {
    id: 'lookbook_test0001',
    name,
    type: 'movie',
    definition: {
      thesis: {
        statement: 'The visual thesis.',
        principles: ['Keep contrast legible.'],
      },
      palette: {
        description: 'Muted color with clear accents.',
        colors: [],
        observations: [],
      },
      toneMood: {
        tone: 'restrained',
        moodTags: ['quiet'],
        description: 'Controlled and grounded.',
      },
      composition: {
        description: 'Frames are composed with clear subject priority.',
        patterns: [],
      },
      lighting: {
        description: 'Light is motivated and directional.',
        patterns: [],
      },
      texture: {
        description: 'Surfaces are tactile.',
        observations: [],
      },
      camera: {
        description: 'Camera language is patient.',
        movement: [],
        motion: [],
        framing: [],
      },
    },
  };
}
