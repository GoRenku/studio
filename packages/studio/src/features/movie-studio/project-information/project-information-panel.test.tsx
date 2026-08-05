// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectInformationResource } from '@gorenku/studio-core/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  patchProjectInformation,
  readProject,
  readProjectInformationResource,
} from '@/services/studio-projects-api';
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
      synopsis: 'A refreshed project synopsis.',
      premise: 'A refreshed project premise.',
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
  patchProjectInformation: vi.fn(),
}));

describe('ProjectInformationPanel', () => {
  beforeEach(() => {
    vi.mocked(readProject).mockReset();
    vi.mocked(readProject).mockResolvedValue(
      makeProject({ title: 'Preparation of the Siege' })
    );
    vi.mocked(readProjectInformationResource).mockReset();
    vi.mocked(readProjectInformationResource).mockImplementation((projectName) =>
      Promise.resolve(makeInformationResource(
        projectName === 'constantinople'
          ? 'Preparation of the Siege of Constantinople 2'
          : projectName
      ))
    );
    vi.mocked(patchProjectInformation).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('renders one Project language selector without multi-locale management controls', async () => {
    renderPanel(makeProject({ title: 'Preparation of the Siege' }));

    await waitFor(() =>
      expect(screen.getByText('Project language')).not.toBeNull()
    );
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getAllByLabelText('Project language')).toHaveLength(1);
    expect(screen.queryByText('Add language')).toBeNull();
    expect(screen.queryByText('Audio')).toBeNull();
    expect(screen.queryByText('Subtitles')).toBeNull();
    expect(screen.queryByLabelText(/Remove /)).toBeNull();
  });

  it('advances the persisted baseline after a superseded successful save', async () => {
    const firstSave = deferred<ProjectInformationResource>();
    vi.mocked(patchProjectInformation)
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({
        ...makeInformationResource('Local working title'),
        logline: 'Local working logline',
      });
    renderPanel(makeProject({ title: 'Preparation of the Siege' }));
    await waitFor(() => expect(readTitleInput().value).not.toBe(''));
    vi.useFakeTimers();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Local working title' },
    });
    await advanceAutosave();
    fireEvent.change(screen.getByLabelText('Logline'), {
      target: { value: 'Local working logline' },
    });
    await advanceAutosave();

    firstSave.resolve(makeInformationResource('Local working title'));
    await settlePromises();

    expect(patchProjectInformation).toHaveBeenCalledTimes(2);
    expect(patchProjectInformation).toHaveBeenNthCalledWith(
      2,
      'constantinople',
      { logline: 'Local working logline' }
    );
  });

  it('keeps the prior baseline when a superseded save fails', async () => {
    const firstSave = deferred<ProjectInformationResource>();
    vi.mocked(patchProjectInformation)
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({
        ...makeInformationResource('Local working title'),
        logline: 'Local working logline',
      });
    renderPanel(makeProject({ title: 'Preparation of the Siege' }));
    await waitFor(() => expect(readTitleInput().value).not.toBe(''));
    vi.useFakeTimers();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Local working title' },
    });
    await advanceAutosave();
    fireEvent.change(screen.getByLabelText('Logline'), {
      target: { value: 'Local working logline' },
    });
    await advanceAutosave();

    firstSave.reject(new Error('Save failed'));
    await settlePromises();

    expect(patchProjectInformation).toHaveBeenCalledTimes(2);
    expect(patchProjectInformation).toHaveBeenNthCalledWith(
      2,
      'constantinople',
      {
        title: 'Local working title',
        logline: 'Local working logline',
      }
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
      onSaveStatusChange={() => undefined}
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
      onSaveStatusChange={() => undefined}
    />
  );
}

function makeProject(input: { title: string }): ProjectShellWithHttp {
  return {
    project: {
      id: 'project_test0001',
      projectName: 'constantinople',
      title: input.title,
      aspectRatio: '16:9',
      coverImage: null,
      logline: 'A historical documentary.',
      synopsis: 'A refreshed project synopsis.',
      premise: 'A refreshed project premise.',
      counts: {
        languages: 1,
        castMembers: 0,
        locations: 0,
        props: 0,
        acts: 0,
        sequences: 0,
        scenes: 0,
      },
    },
    coverUrl: null,
    storageRoot: '/tmp/renku-studio',
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
    navigation: {
      cast: { items: [], nextCursor: null },
      locations: { items: [], nextCursor: null },
      props: { items: [], nextCursor: null },
      screenplay: {
        screenplay: {
          opening: [],
          scenes: [],
          sections: [],
          structure: [],
          references: [],
        },
        orderedSceneIds: [],
      },
    },
  };
}

function makeInformationResource(title: string): ProjectInformationResource {
  return {
    title,
    aspectRatio: '16:9',
    logline: 'A historical documentary.',
    synopsis: 'A refreshed project synopsis.',
    premise: 'A refreshed project premise.',
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
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function advanceAutosave(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(700);
    await Promise.resolve();
  });
}

async function settlePromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
