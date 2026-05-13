// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { ProjectInformationPanel } from './project-information-panel';

vi.mock('@/services/studio-projects-api', () => ({
  readProject: vi.fn(),
  readProjectInformationResource: vi.fn((projectName: string) =>
    Promise.resolve({
      title:
        projectName === 'constantinople'
          ? 'Preparation of the Siege of Constantinople 2'
          : projectName,
      aspectRatio: '16:9',
      logline: 'A historical documentary.',
      languages: [
        {
          id: 'language_1',
          localeTag: 'en-US',
          displayName: 'English',
          isBase: true,
          supportsAudio: true,
          supportsSubtitles: true,
        },
      ],
    })
  ),
  updateProjectInformation: vi.fn(),
}));

describe('ProjectInformationPanel', () => {
  it('updates the form when refreshed project information changes externally', async () => {
    const { rerender } = renderPanel(
      makeProject({ title: 'Preparation of the Siege of Constantinople 2' })
    );

    await waitFor(() =>
      expect(readTitleInput().value).toBe(
        'Preparation of the Siege of Constantinople 2'
      )
    );

    rerenderPanel(
      rerender,
      makeProject({ title: 'Preparation of the Siege of Constantinople 3' })
    );

    await waitFor(() =>
      expect(readTitleInput().value).toBe(
        'Preparation of the Siege of Constantinople 3'
      )
    );
  });

  it('does not clobber a local draft with a later project refresh', async () => {
    const { rerender } = renderPanel(
      makeProject({ title: 'Preparation of the Siege of Constantinople 2' })
    );
    await waitFor(() =>
      expect(readTitleInput().value).toBe(
        'Preparation of the Siege of Constantinople 2'
      )
    );
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Local working title' },
    });

    rerenderPanel(
      rerender,
      makeProject({ title: 'Preparation of the Siege of Constantinople 3' })
    );

    await waitFor(() =>
      expect(readTitleInput().value).toBe('Local working title')
    );
  });
});

function readTitleInput(): HTMLInputElement {
  return screen.getByLabelText('Title') as HTMLInputElement;
}

function renderPanel(project: ProjectShellWithHttp) {
  return render(
    <ProjectInformationPanel
      project={project}
      onProjectChange={() => undefined}
      onAutosaveStatusChange={() => undefined}
    />
  );
}

function rerenderPanel(
  rerender: ReturnType<typeof render>['rerender'],
  project: ProjectShellWithHttp
): void {
  rerender(
    <ProjectInformationPanel
      project={project}
      onProjectChange={() => undefined}
      onAutosaveStatusChange={() => undefined}
    />
  );
}

function makeProject(input: { title: string }): ProjectShellWithHttp {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: input.title,
      type: 'standaloneMovie',
      folderPath: '/tmp/renku/constantinople',
      databasePath: '/tmp/renku/constantinople/.renku/project.sqlite',
      aspectRatio: '16:9',
      logline: 'A historical documentary.',
      summary: 'A project summary.',
    },
    coverImage: null,
    coverUrl: null,
    languages: [
      {
        id: 'language_1',
        localeTag: 'en-US',
        displayName: 'English',
        isBase: true,
        supportsAudio: true,
        supportsSubtitles: true,
      },
    ],
    visualLanguageCategories: [],
    visualLanguage: [],
    cast: [],
    continuityReferences: [],
    counts: {
      languages: 1,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 0,
      continuityReferences: 0,
      episodes: 0,
      sequences: 0,
      scenes: 0,
      clips: 0,
    },
    navigation: {
      cast: { items: [], nextCursor: null },
      visualLanguage: { items: [], nextCursor: null },
      continuityReferences: { items: [], nextCursor: null },
      narrative: {
        projectType: 'standaloneMovie',
        sequences: { items: [], nextCursor: null },
      },
    },
  };
}
