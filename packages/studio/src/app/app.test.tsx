// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { ThemeProvider } from './theme-provider';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders the Renku header and project library', async () => {
    mockFetchSequence([
      { project: null },
      {
        library: {
          storageRoot: '/tmp/renku-studio',
          projects: [],
        },
      },
    ]);

    renderApp();

    await screen.findByText('Project Library');
    expect(screen.getByText('Renku')).toBeTruthy();
    expect(screen.getAllByPlaceholderText('Search projects').length).toBeGreaterThan(
      0
    );
  });

  it('renders the current project title after a successful load', async () => {
    mockFetchSequence([{ project: makeProject() }]);

    renderApp();

    await waitFor(() => {
      expect(screen.getAllByText('Preparation of the Siege').length).toBeGreaterThan(
        0
      );
    });
    expect(screen.getAllByText('Sequences').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cast').length).toBeGreaterThan(0);
  });

  it('opens Project Information for projects without cover images', async () => {
    mockFetchSequence([{ project: makeProject({ coverUrl: null }) }]);

    renderApp();

    const projectInformationButton = await screen.findByText('Project Information');
    fireEvent.click(projectInformationButton);

    expect(screen.getByText('Project Name')).toBeTruthy();
    expect(screen.getByDisplayValue('constantinople')).toBeTruthy();
  });
});

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function mockFetchSequence(bodies: unknown[]): void {
  const responses = bodies.map(
    (body) =>
      ({
        ok: true,
        json: async () => body,
      }) as Response
  );
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected fetch call');
    }
    return response;
  });
}

function makeProject(
  options: { coverUrl?: string | null } = {}
): ProjectWithHttp {
  const coverUrl =
    options.coverUrl === undefined
      ? '/studio-api/projects/constantinople/cover'
      : options.coverUrl;

  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
      folderPath: '/tmp/constantinople',
      databasePath: '/tmp/constantinople/.renku/project.sqlite',
    },
    coverImage: coverUrl ? { fileName: 'cover.png' } : null,
    coverUrl,
    languages: [],
    visualLanguage: [],
    cast: [
      {
        id: 'cast_narrator',
        name: 'Narrator',
        kind: 'narrator',
        role: 'voiceover',
      },
    ],
    sequences: [
      {
        id: 'seq_opening',
        number: 1,
        title: 'Opening',
        shortTitle: 'Opening',
        summary: 'The opening sequence.',
        scenes: [
          {
            id: 'scene_1_1',
            title: 'Opening Scene',
            summary: 'The movie begins.',
            clips: [
              {
                id: 'clip_1_1_1',
                title: 'Opening Image',
                summary: 'Establish the movie.',
              },
            ],
          },
        ],
      },
    ],
    episodes: [],
    counts: {
      languages: 0,
      visualLanguage: 0,
      castMembers: 1,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
    },
  };
}
