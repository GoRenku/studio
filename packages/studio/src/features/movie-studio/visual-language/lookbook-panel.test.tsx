// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Lookbook,
  LookbookResource,
} from '@gorenku/studio-core/client';
import {
  readLookbook,
  setActiveLookbook,
} from '@/services/studio-visual-language-api';
import { LookbookPanel } from './lookbook-panel';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-visual-language-api', () => ({
  readLookbook: vi.fn(),
  setActiveLookbook: vi.fn(),
}));

describe('LookbookPanel', () => {
  beforeEach(() => {
    vi.mocked(readLookbook).mockReset();
    vi.mocked(setActiveLookbook).mockReset();
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
});

function lookbookResource(name: string): LookbookResource {
  return {
    valid: true,
    warnings: [],
    project: { name: 'constantinople' },
    resourceKeys: [],
    lookbook: lookbook(name),
    sourceInspirationFolders: [],
    cardImage: null,
    isActive: false,
    images: [],
    imagesBySection: {
      thesis: [],
      palette: [],
      tone_mood: [],
      composition: [],
      lighting: [],
      texture: [],
      camera: [],
    },
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
