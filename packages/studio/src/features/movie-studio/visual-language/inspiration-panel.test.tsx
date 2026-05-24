// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  InspirationAnalysis,
  InspirationFolder,
  InspirationFolderResource,
  InspirationResource,
} from '@gorenku/studio-core/client';
import {
  deleteInspirationImage,
  readInspirationFolder,
  readInspirationResource,
  uploadInspirationImages,
} from '@/services/studio-visual-language-api';
import { InspirationPanel } from './inspiration-panel';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-visual-language-api', () => ({
  deleteInspirationImage: vi.fn(),
  readInspirationFolder: vi.fn(),
  readInspirationResource: vi.fn(),
  uploadInspirationImages: vi.fn(),
}));

describe('InspirationPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteInspirationImage).mockReset();
    vi.mocked(readInspirationFolder).mockReset();
    vi.mocked(readInspirationResource).mockReset();
    vi.mocked(uploadInspirationImages).mockReset();
  });

  it('refreshes the selected folder when a Studio resource event reports changed Inspiration analysis', async () => {
    vi.mocked(readInspirationResource).mockResolvedValue(inspirationResource());
    vi.mocked(readInspirationFolder)
      .mockResolvedValueOnce(inspirationFolderResource(null))
      .mockResolvedValueOnce(inspirationFolderResource(inspirationAnalysis()));

    render(
      <InspirationPanel
        projectName='constantinople'
        folderId='inspiration_folder_test0001'
        foldersRevision={0}
      />
    );

    expect(await screen.findByText('Grabs')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople',
            resourceKeys: [
              'surface:visual-language:inspiration:inspiration_folder_test0001',
            ],
          },
        })
      );
    });

    await waitFor(() => {
      expect(vi.mocked(readInspirationFolder)).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('The thesis')).not.toBeNull();
    expect(screen.getByText('Reference images use quiet contrast.')).not.toBeNull();
  });
});

const folder: InspirationFolder = {
  id: 'inspiration_folder_test0001',
  name: 'Blade Runner 2049',
  projectRelativePath: 'visual-language/inspiration/blade-runner-2049' as never,
};

function inspirationResource(): InspirationResource {
  return {
    folders: {
      items: [folder],
      nextCursor: null,
    },
  };
}

function inspirationFolderResource(
  analysis: InspirationAnalysis | null
): InspirationFolderResource {
  return {
    folder,
    images: [
      {
        fileName: 'frame-001.png',
        mediaKind: 'image',
        projectRelativePath:
          'visual-language/inspiration/blade-runner-2049/frame-001.png' as never,
      },
    ],
    analysis,
  };
}

function inspirationAnalysis(): InspirationAnalysis {
  return {
    folderId: folder.id,
    thesis: {
      statement: 'Reference images use quiet contrast.',
      principles: ['Preserve motivated contrast.'],
      imageFiles: ['frame-001.png'],
    },
    palette: {
      description: 'Muted colors with disciplined warmth.',
      colors: [{ hex: '#AABBCC', name: 'Cold dawn', meaning: 'Distance and control.' }],
      observations: [{ text: 'Blue-gray dominates.', imageFiles: ['frame-001.png'] }],
    },
    toneMood: {
      tone: 'weathered restraint',
      moodTags: ['restrained'],
      description: 'Low saturation and soft contrast keep the images subdued.',
      imageFiles: ['frame-001.png'],
    },
    composition: {
      description: 'Frames favor stillness and pressure.',
      patterns: [
        {
          name: 'Centered pressure',
          description: 'Subjects hold center while negative space bears down.',
          imageFiles: ['frame-001.png'],
        },
      ],
    },
    lighting: {
      description: 'Light is motivated and directional.',
      patterns: [
        {
          name: 'Practical falloff',
          description: 'Faces fall away quickly from practical sources.',
          imageFiles: ['frame-001.png'],
        },
      ],
    },
    texture: {
      description: 'Surfaces feel tactile and worn.',
      observations: [
        {
          text: 'Soft grain supports worn surfaces.',
          imageFiles: ['frame-001.png'],
        },
      ],
    },
    inspiredBy: {
      description: 'Visual lineage is treated as affinity, not confirmed influence.',
      items: [
        {
          category: 'cinematographer',
          name: 'Roger Deakins',
          confidence: 'medium',
          why: 'Controlled contrast and disciplined negative space are visible affinities.',
          imageFiles: ['frame-001.png'],
        },
      ],
    },
  };
}
