// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Lookbook,
  LookbooksResource,
} from '@gorenku/studio-core/client';
import {
  deleteLookbook,
  listLookbooks,
  setActiveLookbook,
} from '@/services/studio-visual-language-api';
import { LookbooksPanel } from './lookbooks-panel';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-visual-language-api', () => ({
  deleteLookbook: vi.fn(),
  listLookbooks: vi.fn(),
  setActiveLookbook: vi.fn(),
}));

describe('LookbooksPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteLookbook).mockReset();
    vi.mocked(listLookbooks).mockReset();
    vi.mocked(setActiveLookbook).mockReset();
  });

  it('refreshes the Lookbooks grid when a Studio resource event reports changed Lookbooks', async () => {
    vi.mocked(listLookbooks)
      .mockResolvedValueOnce(lookbooksResource('Original lookbook'))
      .mockResolvedValueOnce(lookbooksResource('Updated lookbook'));

    render(
      <LookbooksPanel
        projectName='constantinople'
        onOpenLookbook={vi.fn()}
        onLookbooksChange={vi.fn()}
      />
    );

    expect(await screen.findByText('Original lookbook')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople',
            resourceKeys: ['surface:visual-language:lookbooks'],
          },
        })
      );
    });

    await waitFor(() => {
      expect(vi.mocked(listLookbooks)).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Updated lookbook')).not.toBeNull();
  });
});

function lookbooksResource(name: string): LookbooksResource {
  return {
    valid: true,
    warnings: [],
    project: { name: 'constantinople' },
    resourceKeys: [],
    activeLookbookId: null,
    lookbooks: [
      {
        lookbook: lookbook(name),
        sourceInspirationFolders: [],
        cardImage: null,
        isActive: false,
      },
    ],
  };
}

function lookbook(name: string): Lookbook {
  return {
    id: 'lookbook_test0001',
    name,
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
  };
}
