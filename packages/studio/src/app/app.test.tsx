// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { ThemeProvider } from './theme-provider';
import type {
  ProjectLibraryWithHttp,
  ProjectWithHttp,
} from '@/services/studio-project-contracts';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.pushState({}, '', '/');
    window.__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'test-token' };
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
    const fetchLog = mockStudioFetch({ library: makeLibrary([]) });

    renderApp();

    await screen.findByText('Project Library');
    expect(screen.getByText('Renku')).toBeTruthy();
    expect(screen.getAllByPlaceholderText('Search projects').length).toBeGreaterThan(
      0
    );
    expect(fetchLog).not.toContain('/studio-api/projects/current');
  });

  it('opens a project from the project library through the project route', async () => {
    const fetchLog = mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    const projectTitle = await screen.findByText('Preparation of the Siege');
    fireEvent.click(projectTitle.closest('button')!);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/constantinople');
    });
    await screen.findByText('Sequences');
    expect(fetchLog).toContain('/studio-api/projects/constantinople');
    expect(fetchLog.some((url) => url.includes('/select'))).toBe(false);
  });

  it('returns home from a project route and stays on the project library route', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    const homeButton = await screen.findByLabelText('Go to Renku Studio home');
    fireEvent.click(homeButton);

    await screen.findByText('Project Library');
    expect(window.location.pathname).toBe('/');
  });

  it('does not replay historical focus requests when opening the project library route', async () => {
    let selectWasCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === '/studio-api/projects') {
        return jsonResponse({
          library: {
            storageRoot: '/tmp/renku-studio',
            projects: [],
          },
        });
      }
      if (url === '/studio-api/studio/events/current') {
        return jsonResponse(emptyStudioCurrent());
      }
      if (url === '/studio-api/studio/events/browser-sessions/active') {
        return jsonResponse({});
      }
      if (url === '/studio-api/studio/events') {
        return jsonResponse({
          events: [
            {
              id: 'studio_event_old_focus',
              type: 'studio.focusRequested',
              createdAt: '2026-05-11T00:00:00.000Z',
              projectRef: {
                name: 'constantinople',
                id: 'project_test0001',
                storageRoot: '/tmp',
              },
              focus: {
                screen: 'movieStudio',
                selection: { type: 'projectInformation' },
              },
            },
          ],
          nextCursor: '100',
          warnings: [],
        });
      }
      if (url.includes('/select')) {
        selectWasCalled = true;
      }
      return jsonResponse({ events: [], nextCursor: '100', warnings: [] });
    });

    renderApp();

    await screen.findByText('Project Library');
    expect(window.location.pathname).toBe('/');
    expect(selectWasCalled).toBe(false);
  });

  it('lets fresh coordination focus requests navigate through the project route', async () => {
    let selectWasCalled = false;
    let eventReadCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === '/studio-api/projects') {
        return jsonResponse({
          library: {
            storageRoot: '/tmp/renku-studio',
            projects: [],
          },
        });
      }
      if (url === '/studio-api/projects/constantinople') {
        return jsonResponse({ project: makeProject() });
      }
      if (url === '/studio-api/studio/events/current') {
        return jsonResponse(emptyStudioCurrent());
      }
      if (url === '/studio-api/studio/events/focus-requests/validate') {
        return jsonResponse({ valid: true });
      }
      if (
        url === '/studio-api/studio/events/browser-sessions/active' ||
        url === '/studio-api/studio/events/focus-changes'
      ) {
        return jsonResponse({});
      }
      if (url.startsWith('/studio-api/studio/events')) {
        eventReadCount += 1;
        return jsonResponse(
          eventReadCount === 1
            ? { events: [], nextCursor: '100', warnings: [] }
            : {
                events: [
                  {
                    id: 'studio_event_new_focus',
                    type: 'studio.focusRequested',
                    createdAt: '2026-05-11T00:00:00.000Z',
                    projectRef: {
                      name: 'constantinople',
                      id: 'project_test0001',
                      storageRoot: '/tmp',
                    },
                    focus: {
                      screen: 'movieStudio',
                      selection: { type: 'projectInformation' },
                    },
                  },
                ],
                nextCursor: '200',
                warnings: [],
              }
        );
      }
      if (url.includes('/select')) {
        selectWasCalled = true;
      }
      return jsonResponse({});
    });

    renderApp();

    await waitFor(() => {
      expect(eventReadCount).toBeGreaterThan(1);
      expect(window.location.pathname).toBe('/projects/constantinople');
    });
    await screen.findByText('Sequences');
    expect(selectWasCalled).toBe(false);
  });

  it('applies a non-stale pending coordination focus request when Studio starts', async () => {
    let selectWasCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === '/studio-api/projects') {
        return jsonResponse({
          library: {
            storageRoot: '/tmp/renku-studio',
            projects: [],
          },
        });
      }
      if (url === '/studio-api/projects/constantinople') {
        return jsonResponse({ project: makeProject() });
      }
      if (url === '/studio-api/studio/events') {
        return jsonResponse({ events: [], nextCursor: '100', warnings: [] });
      }
      if (url === '/studio-api/studio/events/current') {
        return jsonResponse({
          ...emptyStudioCurrent(),
          pendingRequest: {
            eventId: 'studio_event_pending_focus',
            createdAt: '2026-05-12T00:00:00.000Z',
            projectRef: {
              name: 'constantinople',
              id: 'project_test0001',
              storageRoot: '/tmp',
            },
            focus: {
              screen: 'movieStudio',
              selection: { type: 'projectInformation' },
            },
            refresh: { project: true },
          },
        });
      }
      if (url === '/studio-api/studio/events/focus-requests/validate') {
        return jsonResponse({ valid: true });
      }
      if (
        url === '/studio-api/studio/events/browser-sessions/active' ||
        url === '/studio-api/studio/events/focus-changes'
      ) {
        return jsonResponse({});
      }
      if (url.includes('/select')) {
        selectWasCalled = true;
      }
      return jsonResponse({});
    });

    renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/constantinople');
    });
    await screen.findByText('Project Name');
    expect(selectWasCalled).toBe(false);
  });

  it('renders the project route title after a successful load', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({ project: makeProject() });

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
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({ project: makeProject({ coverUrl: null }) });

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

function mockStudioFetch(input: {
  library?: ProjectLibraryWithHttp;
  project?: ProjectWithHttp;
}): string[] {
  const fetchLog: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (request) => {
    const url = requestUrl(request);
    fetchLog.push(url);
    if (url === '/studio-api/projects') {
      return jsonResponse({ library: input.library ?? makeLibrary([]) });
    }
    if (url === '/studio-api/projects/constantinople') {
      return jsonResponse({ project: input.project ?? makeProject() });
    }
    if (url === '/studio-api/studio/events/current') {
      return jsonResponse(emptyStudioCurrent());
    }
    if (
      url === '/studio-api/studio/events/browser-sessions/active' ||
      url === '/studio-api/studio/events/focus-changes'
    ) {
      return jsonResponse({});
    }
    if (url.startsWith('/studio-api/studio/events')) {
      return jsonResponse({ events: [], nextCursor: '0', warnings: [] });
    }
    return jsonResponse({});
  });
  return fetchLog;
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function emptyStudioCurrent() {
  return {
    studio: { running: true },
    project: null,
    selection: null,
    context: null,
    pendingRequest: null,
    warnings: [],
  };
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
    visualLanguageCategories: [],
    visualLanguage: [],
    cast: [
      {
        id: 'cast_narrator',
        name: 'Narrator',
        kind: 'narrator',
        role: 'voiceover',
      },
    ],
    continuityReferences: [],
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
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      continuityReferences: 0,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
    },
  };
}

function makeLibrary(projects: ProjectLibraryWithHttp['projects']): ProjectLibraryWithHttp {
  return {
    storageRoot: '/tmp/renku-studio',
    projects,
  };
}

function makeProjectSummary(): ProjectLibraryWithHttp['projects'][number] {
  return {
    name: 'constantinople',
    title: 'Preparation of the Siege',
    type: 'standaloneMovie',
    folderPath: '/tmp/constantinople',
    coverImage: { fileName: 'cover.png' },
    coverUrl: '/studio-api/projects/constantinople/cover',
    logline: 'A documentary about preparation before 1453.',
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      continuityReferences: 0,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
    },
    validationError: null,
  };
}
