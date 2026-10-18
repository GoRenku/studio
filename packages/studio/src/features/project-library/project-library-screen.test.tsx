// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectLibraryWithHttp, ProjectSummaryWithHttp } from '@/services/studio-project-contracts';
import type { StudioUpdateController } from '@/app/use-studio-update';
import { ProjectLibraryScreen } from './project-library-screen';

const readSampleFilmMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/studio-app-header', () => ({ StudioAppHeader: () => null }));
vi.mock('@/services/studio-projects-api', () => ({ deleteProject: vi.fn(), createProject: vi.fn() }));
vi.mock('@/services/sample-film-api', () => ({
  readSampleFilm: readSampleFilmMock,
  startSampleFilmInstallation: vi.fn(),
}));

const project: ProjectSummaryWithHttp = {
  projectName: 'night-market',
  title: 'Night Market',
  folderPath: '/library/night-market',
  coverImage: null,
  coverUrl: null,
  counts: null,
  validationError: null,
};

function library(projects: ProjectSummaryWithHttp[]): ProjectLibraryWithHttp {
  return { storageRoot: '/library', projects } as ProjectLibraryWithHttp;
}

async function renderScreen(projects: ProjectSummaryWithHttp[], inLibrary = false) {
  readSampleFilmMock.mockResolvedValue({ archiveBytes: 375_000_000, inLibrary, installation: { state: 'idle' } });
  await act(async () => {
    render(
      <ProjectLibraryScreen
        update={{} as StudioUpdateController}
        error={null}
        library={library(projects)}
        isLoadingLibrary={false}
        isSelectingProject={false}
        onRefresh={vi.fn(async () => {})}
        onSelectProject={vi.fn(async () => {})}
      />
    );
  });
}

describe('ProjectLibraryScreen', () => {
  afterEach(() => {
    cleanup();
    readSampleFilmMock.mockReset();
  });

  it('shows the four starts in an empty Library', async () => {
    await renderScreen([]);

    expect(screen.getByRole('heading', { name: 'Start your first film' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Explore the sample film' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Start an empty project' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Import a screenplay' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Write a scene with your agent' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Create Project' })).toHaveLength(2);
  });

  it('shows the projects and the sample tile when the sample is not in the Library', async () => {
    await renderScreen([project]);

    expect(screen.getByRole('button', { name: /Night Market/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Explore the sample film' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Start your first film' })).toBeNull();
  });

  it('leaves out the sample tile once the sample is in the Library', async () => {
    await renderScreen([project], true);

    expect(screen.getByRole('button', { name: /Night Market/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Explore the sample film' })).toBeNull();
  });

  it('shows the no-match message for a search without results', async () => {
    await renderScreen([project]);

    fireEvent.change(screen.getAllByPlaceholderText('Search projects')[0]!, { target: { value: 'zzz' } });

    expect(screen.getByRole('heading', { name: 'No matching projects' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Explore the sample film' })).toBeNull();
  });
});
