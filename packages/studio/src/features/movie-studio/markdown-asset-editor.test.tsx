// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  MarkdownAssetContent,
  RichTextAssetLink,
} from '@gorenku/studio-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readMarkdownAssetContent,
  updateMarkdownAssetContent,
} from '@/services/studio-project-assets-api';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import { MarkdownAssetEditor } from './markdown-asset-editor';

vi.mock('@/services/studio-project-assets-api', () => ({
  readMarkdownAssetContent: vi.fn(),
  updateMarkdownAssetContent: vi.fn(),
}));

describe('MarkdownAssetEditor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads Markdown asset content by asset link', async () => {
    vi.mocked(readMarkdownAssetContent).mockResolvedValue(
      makeContent('Clip summary from server.')
    );

    renderEditor();

    expect(
      await screen.findByDisplayValue('Clip summary from server.')
    ).toBeTruthy();
    expect(readMarkdownAssetContent).toHaveBeenCalledWith('constantinople', {
      assetId: 'asset_clip_summary',
      assetFileId: 'asset_file_clip_summary',
    });
  });

  it('saves edited Markdown content and returns the updated project', async () => {
    const updatedProject = makeProject('Updated clip summary.');
    const onProjectChange = vi.fn();
    vi.mocked(readMarkdownAssetContent).mockResolvedValue(
      makeContent('Clip summary from server.')
    );
    vi.mocked(updateMarkdownAssetContent).mockResolvedValue({
      content: makeContent('Updated clip summary.'),
      project: updatedProject,
    });

    renderEditor({ onProjectChange });

    const textarea = await screen.findByDisplayValue(
      'Clip summary from server.'
    );
    fireEvent.change(textarea, {
      target: { value: 'Updated clip summary.' },
    });

    await waitFor(() => {
      expect(updateMarkdownAssetContent).toHaveBeenCalledWith(
        'constantinople',
        {
          assetId: 'asset_clip_summary',
          assetFileId: 'asset_file_clip_summary',
        },
        'Updated clip summary.'
      );
    });
    expect(onProjectChange).toHaveBeenCalledWith(updatedProject);
  });

  it('shows save errors without clearing the draft', async () => {
    vi.mocked(readMarkdownAssetContent).mockResolvedValue(
      makeContent('Clip summary from server.')
    );
    vi.mocked(updateMarkdownAssetContent).mockRejectedValue(
      new Error('content must be a string.')
    );

    renderEditor();

    const textarea = await screen.findByDisplayValue(
      'Clip summary from server.'
    );
    fireEvent.change(textarea, {
      target: { value: 'Updated local draft.' },
    });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'content must be a string.'
    );
    expect(screen.getByDisplayValue('Updated local draft.')).toBeTruthy();
  });
});

function renderEditor(
  options: { onProjectChange?: (project: ProjectWithHttp) => void } = {}
) {
  return render(
    <MarkdownAssetEditor
      projectName='constantinople'
      label='Clip Brief'
      asset={makeAsset()}
      initialContent=''
      emptyMessage='No editable clip brief asset is attached yet.'
      autosaveDelayMs={1}
      onProjectChange={options.onProjectChange ?? (() => undefined)}
    />
  );
}

function makeAsset(): RichTextAssetLink {
  return {
    assetId: 'asset_clip_summary',
    assetFileId: 'asset_file_clip_summary',
    role: 'summary',
    projectRelativePath:
      'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
  };
}

function makeContent(content: string): MarkdownAssetContent {
  return {
    assetId: 'asset_clip_summary',
    assetFileId: 'asset_file_clip_summary',
    projectRelativePath:
      'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
    content,
  };
}

function makeProject(summary: string): ProjectWithHttp {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
      folderPath: '/tmp/renku/constantinople',
      databasePath: '/tmp/renku/constantinople/.renku/project.sqlite',
    },
    coverImage: null,
    coverUrl: null,
    languages: [],
    visualLanguageCategories: [],
    visualLanguage: [],
    cast: [],
    continuityReferences: [],
    episodes: [],
    sequences: [
      {
        id: 'sequence_test0001',
        number: 1,
        title: 'Opening',
        scenes: [
          {
            id: 'scene_test0001',
            title: 'Opening Scene',
            clips: [
              {
                id: 'clip_test0001',
                title: 'Opening Image',
                summary,
                summaryAsset: makeAsset(),
              },
            ],
          },
        ],
      },
    ],
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 0,
      continuityReferences: 0,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
    },
  };
}
