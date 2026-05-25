// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  InspirationAnalysis,
  InspirationFolder,
  InspirationFolderResource,
  InspirationResource,
} from '@gorenku/studio-core/client';
import {
  deleteInspirationFolder,
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
  deleteInspirationFolder: vi.fn(),
  deleteInspirationImage: vi.fn(),
  readInspirationFolder: vi.fn(),
  readInspirationResource: vi.fn(),
  uploadInspirationImages: vi.fn(),
}));

describe('InspirationPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteInspirationFolder).mockReset();
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
        onOpenFolder={vi.fn()}
        onInspirationFoldersChange={vi.fn()}
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

  it('refreshes overview card metadata after uploading images to the selected folder', async () => {
    vi.mocked(readInspirationResource)
      .mockResolvedValueOnce(inspirationResource({ imageCount: 0, cardImage: null }))
      .mockResolvedValueOnce(inspirationResource());
    vi.mocked(readInspirationFolder).mockResolvedValue(
      inspirationFolderResource(null, { images: [] })
    );
    vi.mocked(uploadInspirationImages).mockResolvedValue(
      inspirationFolderResource(null)
    );

    const { container, rerender } = render(
      <InspirationPanel
        projectName='constantinople'
        folderId='inspiration_folder_test0001'
        foldersRevision={0}
        onOpenFolder={vi.fn()}
        onInspirationFoldersChange={vi.fn()}
      />
    );

    expect(await screen.findByText('Drop grabs here or upload images.')).not.toBeNull();

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement | null;
    const files = [new File(['first'], 'frame-001.png', { type: 'image/png' })];
    fireEvent.change(input!, { target: { files } });

    await waitFor(() => {
      expect(vi.mocked(readInspirationResource)).toHaveBeenCalledTimes(2);
    });

    rerender(
      <InspirationPanel
        projectName='constantinople'
        foldersRevision={0}
        onOpenFolder={vi.fn()}
        onInspirationFoldersChange={vi.fn()}
      />
    );

    expect(await screen.findByText('1 image')).not.toBeNull();
  });
});

const folder: InspirationFolder = {
  id: 'inspiration_folder_test0001',
  name: 'Blade Runner 2049',
  projectRelativePath: 'visual-language/inspiration/blade-runner-2049' as never,
};

function inspirationResource({
  imageCount = 1,
  cardImage = {
    fileName: 'frame-001.png',
    mediaKind: 'image',
    projectRelativePath:
      'visual-language/inspiration/blade-runner-2049/frame-001.png' as never,
  },
}: {
  imageCount?: number;
  cardImage?: InspirationResource['folders']['items'][number]['cardImage'];
} = {}): InspirationResource {
  return {
    folders: {
      items: [
        {
          folder,
          cardImage,
          imageCount,
        },
      ],
      nextCursor: null,
    },
  };
}

function inspirationFolderResource(
  analysis: InspirationAnalysis | null,
  {
    images = [
      {
        fileName: 'frame-001.png',
        mediaKind: 'image',
        projectRelativePath:
          'visual-language/inspiration/blade-runner-2049/frame-001.png' as never,
      },
    ],
  }: Pick<InspirationFolderResource, 'images'> = {
    images: [
      {
        fileName: 'frame-001.png',
        mediaKind: 'image',
        projectRelativePath:
          'visual-language/inspiration/blade-runner-2049/frame-001.png' as never,
      },
    ],
  }
): InspirationFolderResource {
  return {
    folder,
    images,
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
