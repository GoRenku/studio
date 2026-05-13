// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { ThemeProvider } from './theme-provider';
import type {
  ProjectLibraryWithHttp,
  ProjectShellWithHttp,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import type { StudioSelection } from '@/features/movie-studio/movie-studio-selection';

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
    await screen.findByText('Project Name');
    await screen.findByText('Sequences');
    expect(fetchLog).toContain('/studio-api/projects/constantinople');
    expect(fetchLog.some((url) => url.includes('/select'))).toBe(false);
  });

  it('loads canonical Movie Studio selection routes', async () => {
    const project = makeProject();
    const routeCases: Array<{
      path: string;
      expectedText: string;
    }> = [
      {
        path: '/projects/constantinople',
        expectedText: 'Project Name',
      },
      {
        path: '/projects/constantinople/visual-language',
        expectedText: 'Visual Language',
      },
      {
        path: '/projects/constantinople/storyboard',
        expectedText: 'Full Storyboard',
      },
      {
        path: '/projects/constantinople/sequences/seq_opening',
        expectedText: '1 scenes, 1 clips.',
      },
      {
        path: '/projects/constantinople/scenes/scene_1_1',
        expectedText: 'Opening Scene',
      },
      {
        path: '/projects/constantinople/clips/clip_1_1_1',
        expectedText: 'Opening Image',
      },
      {
        path: '/projects/constantinople/cast',
        expectedText: 'narrator / voiceover',
      },
      {
        path: '/projects/constantinople/cast/cast_narrator',
        expectedText: 'Narrator reference',
      },
    ];

    for (const routeCase of routeCases) {
      window.history.pushState({}, '', routeCase.path);
      mockStudioFetch({
        library: makeLibrary([makeProjectSummary()]),
        project,
      });
      const { unmount } = renderApp();

      await waitFor(() => {
        expect(screen.getAllByText(routeCase.expectedText).length).toBeGreaterThan(
          0
        );
      });
      expect(window.location.pathname).toBe(routeCase.path);
      unmount();
    }
  });

  it('loads a cast member from the canonical cast route', async () => {
    window.history.pushState({}, '', '/projects/constantinople/cast/cast_narrator');
    const fetchLog = mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Narrator reference');
    expect(fetchLog).toContain('/studio-api/projects/constantinople');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );
  });

  it('loads a direct sequence route when the selected sequence is outside the shell page', async () => {
    const project = {
      ...makeProject(),
      navigation: {
        ...makeProjectNavigation(),
        narrative: {
          projectType: 'standaloneMovie' as const,
          sequences: { items: [], nextCursor: 'after-first-page' },
        },
      },
    };
    const fetchLog: string[] = [];
    window.history.pushState(
      {},
      '',
      '/projects/constantinople/sequences/seq_late'
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (request) => {
      const url = requestUrl(request);
      fetchLog.push(url);
      if (url === '/studio-api/projects/constantinople') {
        return jsonResponse({ project });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/movie-studio-selection/context'
      ) {
        return jsonResponse({
          valid: true,
          selection: { type: 'sequence', id: 'seq_late' },
          context: {
            surface: 'sequence',
            sequence: {
              id: 'seq_late',
              number: 150,
              title: 'Late Sequence',
              sceneCount: 0,
              clipCount: 0,
            },
          },
          resourceKeys: ['navigation:movie-sequences'],
        });
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

    renderApp();

    await waitFor(() => {
      expect(screen.getAllByText('Late Sequence').length).toBeGreaterThan(0);
    });
    expect(fetchLog).toContain(
      '/studio-api/projects/constantinople/movie-studio-selection/context'
    );
    expect(window.location.pathname).toBe(
      '/projects/constantinople/sequences/seq_late'
    );
  });

  it('loads a direct clip route through selection context without eager shell children', async () => {
    const project = {
      ...makeProject(),
      navigation: {
        ...makeProjectNavigation(),
        narrative: {
          projectType: 'standaloneMovie' as const,
          sequences: { items: [], nextCursor: 'after-first-page' },
        },
      },
    };
    window.history.pushState({}, '', '/projects/constantinople/clips/clip_late');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (request) => {
      const url = requestUrl(request);
      if (url === '/studio-api/projects/constantinople') {
        return jsonResponse({ project });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/movie-studio-selection/context'
      ) {
        return jsonResponse({
          valid: true,
          selection: { type: 'clip', id: 'clip_late' },
          context: {
            surface: 'clip-design',
            sequence: {
              id: 'seq_late',
              number: 150,
              title: 'Late Sequence',
              sceneCount: 1,
              clipCount: 1,
            },
            scene: {
              id: 'scene_late',
              sequenceId: 'seq_late',
              title: 'Late Scene',
              clipCount: 1,
            },
            clip: {
              id: 'clip_late',
              sceneId: 'scene_late',
              title: 'Late Clip',
              oneLineSummary: 'Loaded from selection context.',
            },
          },
          resourceKeys: ['surface:clip-design:clip_late'],
        });
      }
      if (url === '/studio-api/projects/constantinople/clips/clip_late/design') {
        return jsonResponse({ resource: null });
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

    renderApp();

    await screen.findByText('Late Clip');
    expect(window.location.pathname).toBe('/projects/constantinople/clips/clip_late');
  });

  it('loads sequence scenes and scene clips through navigation pages', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    const fetchLog = mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Opening');
    fireEvent.click(screen.getByLabelText('Expand Opening'));

    await screen.findByText('Opening Scene');
    expect(screen.getByText('1 scenes, 1 clips')).toBeTruthy();
    expect(screen.getByText('1 clips')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Expand Opening Scene'));

    await screen.findByText('Opening Image');
    expect(fetchLog).toContain(
      '/studio-api/projects/constantinople/sequences/seq_opening/scenes'
    );
    expect(fetchLog).toContain(
      '/studio-api/projects/constantinople/scenes/scene_1_1/clips'
    );
  });

  it('updates the URL when a cast member is selected from the sidebar', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Sequences');
    fireEvent.click(screen.getByText('Narrator'));

    await screen.findByText('Narrator reference');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );
  });

  it('uses browser history to restore route-owned Movie Studio selections', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Project Name');
    fireEvent.click(screen.getByText('Narrator'));
    await screen.findByText('Narrator reference');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );

    window.history.back();
    fireEvent.popState(window);
    await screen.findByText('Project Name');
    expect(window.location.pathname).toBe('/projects/constantinople');

    window.history.forward();
    fireEvent.popState(window);
    await screen.findByText('Narrator reference');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );
  });

  it('keeps the Studio shell mounted when switching between cast members', async () => {
    window.history.pushState(
      {},
      '',
      '/projects/constantinople/cast/cast_narrator'
    );
    const project = makeProject();
    project.cast = [
      ...project.cast,
      {
        id: 'cast_mehmed',
        name: 'Mehmed',
        kind: 'character',
        role: 'sultan',
      },
    ];
    project.counts.castMembers = 2;
    const mehmedAssets = deferredResponse();
    let projectReadCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (request) => {
      const url = requestUrl(request);
      if (url === '/studio-api/projects/constantinople') {
        projectReadCount += 1;
        return jsonResponse({ project });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/cast/cast_narrator/design?role=character_sheet'
      ) {
        return jsonResponse({ resource: makeCastDesignResource([makeCastAsset()]) });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/cast/cast_mehmed/design?role=character_sheet'
      ) {
        return mehmedAssets.promise;
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

    renderApp();

    await screen.findByText('Narrator reference');
    fireEvent.click(screen.getByText('Mehmed'));

    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_mehmed'
    );
    expect(screen.queryByText('Loading Renku Studio...')).toBeNull();
    expect(screen.getByText('Loading cast assets...')).toBeTruthy();
    expect(projectReadCount).toBe(1);

    mehmedAssets.resolve(
      jsonResponse({
        resource: makeCastDesignResource([
          makeCastAsset({
            assetId: 'asset_mehmed_reference',
            castMemberId: 'cast_mehmed',
            title: 'Mehmed reference',
          }),
        ]),
      })
    );

    await screen.findByText('Mehmed reference');
    expect(projectReadCount).toBe(1);
  });

  it('rejects an unknown cast member route instead of falling back', async () => {
    window.history.pushState({}, '', '/projects/constantinople/cast/cast_missing');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Project Library');
    expect(screen.getByText('Cast member not found: cast_missing')).toBeTruthy();
  });

  it('rejects unknown story selection routes instead of falling back', async () => {
    const routeCases = [
      {
        path: '/projects/constantinople/sequences/seq_missing',
        message: 'Sequence not found: seq_missing',
      },
      {
        path: '/projects/constantinople/scenes/scene_missing',
        message: 'Scene not found: scene_missing',
      },
      {
        path: '/projects/constantinople/clips/clip_missing',
        message: 'Clip not found: clip_missing',
      },
    ];

    for (const routeCase of routeCases) {
      window.history.pushState({}, '', routeCase.path);
      mockStudioFetch({
        library: makeLibrary([makeProjectSummary()]),
        project: makeProject(),
      });
      const { unmount } = renderApp();

      await screen.findByText('Project Library');
      expect(screen.getByText(routeCase.message)).toBeTruthy();
      unmount();
    }
  });

  it('rejects unknown project child routes instead of falling back', async () => {
    window.history.pushState({}, '', '/projects/constantinople/not-a-surface');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Project Library');
    expect(
      screen.getByText('Unknown project route: /projects/constantinople/not-a-surface')
    ).toBeTruthy();
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
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
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
      if (url === '/studio-api/studio/events/focus-failures') {
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
    }, { timeout: 2_500 });
    await screen.findByText('Sequences');
    expect(selectWasCalled).toBe(false);
  });

  it.each([
    [
      'Project Information',
      { type: 'projectInformation' },
      '/projects/constantinople',
    ],
    [
      'Visual Language',
      { type: 'visualLanguage' },
      '/projects/constantinople/visual-language',
    ],
    ['Storyboard', { type: 'storyboard' }, '/projects/constantinople/storyboard'],
    [
      'Sequence',
      { type: 'sequence', id: 'seq_opening' },
      '/projects/constantinople/sequences/seq_opening',
    ],
    [
      'Scene',
      { type: 'scene', id: 'scene_1_1' },
      '/projects/constantinople/scenes/scene_1_1',
    ],
    [
      'Clip',
      { type: 'clip', id: 'clip_1_1_1' },
      '/projects/constantinople/clips/clip_1_1_1',
    ],
    ['Cast overview', { type: 'casting' }, '/projects/constantinople/cast'],
    [
      'Cast member',
      { type: 'cast', id: 'cast_narrator' },
      '/projects/constantinople/cast/cast_narrator',
    ],
  ] satisfies Array<[string, StudioSelection, string]>)(
    'routes CLI-style pending focus requests for %s to the canonical URL',
    async (_label, selection, expectedPath) => {
    const reportedAppliedRequestIds: string[] = [];
    const reportedAppliedFocuses: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
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
      if (
        url ===
        '/studio-api/projects/constantinople/movie-studio-selection/context'
      ) {
        return jsonResponse(makeSelectionContextResponse(selection));
      }
      if (url === '/studio-api/studio/events/current') {
        return jsonResponse({
          ...emptyStudioCurrent(),
          pendingRequest: {
            eventId: 'studio_event_selection_focus',
            createdAt: '2026-05-12T00:00:00.000Z',
            projectRef: {
              name: 'constantinople',
              id: 'project_test0001',
              storageRoot: '/tmp',
            },
            focus: {
              screen: 'movieStudio',
              selection,
            },
          },
        });
      }
      if (url === '/studio-api/studio/events/focus-requests/validate') {
        return jsonResponse({ valid: true });
      }
      if (url === '/studio-api/studio/events/focus-changes') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (body.appliedRequestId) {
          reportedAppliedRequestIds.push(body.appliedRequestId);
          reportedAppliedFocuses.push(body.focus);
        }
        return jsonResponse({});
      }
      if (
        url === '/studio-api/studio/events/browser-sessions/active' ||
        url === '/studio-api/studio/events/focus-failures'
      ) {
        return jsonResponse({});
      }
      if (url.startsWith('/studio-api/studio/events')) {
        return jsonResponse({ events: [], nextCursor: '100', warnings: [] });
      }
      return jsonResponse({});
    });

    renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe(expectedPath);
    }, { timeout: 2_500 });
    await waitFor(() => {
      expect(reportedAppliedRequestIds).toContain('studio_event_selection_focus');
    });
    expect(reportedAppliedFocuses).toContainEqual({
      screen: 'movieStudio',
      selection,
    });
  });

  it('applies only the newest focus request from a polling batch', async () => {
    let eventReadCount = 0;
    let validationCount = 0;
    const reportedAppliedRequestIds: string[] = [];
    const reportedAppliedFocuses: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
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
        validationCount += 1;
        return jsonResponse({ valid: true });
      }
      if (url === '/studio-api/studio/events/focus-changes') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (body.appliedRequestId) {
          reportedAppliedRequestIds.push(body.appliedRequestId);
          reportedAppliedFocuses.push(body.focus);
        }
        return jsonResponse({});
      }
      if (url === '/studio-api/studio/events/browser-sessions/active') {
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
                      selection: { type: 'storyboard' },
                    },
                  },
                  {
                    id: 'studio_event_new_focus',
                    type: 'studio.focusRequested',
                    createdAt: '2026-05-11T00:00:01.000Z',
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
      return jsonResponse({});
    });

    renderApp();

    await waitFor(() => {
      expect(eventReadCount).toBeGreaterThan(1);
      expect(window.location.pathname).toBe('/projects/constantinople');
    }, { timeout: 2_500 });
    await waitFor(() => {
      expect(reportedAppliedRequestIds).toContain('studio_event_new_focus');
    });
    expect(validationCount).toBe(1);
    expect(reportedAppliedRequestIds).not.toContain('studio_event_old_focus');
    expect(reportedAppliedFocuses).toContainEqual({
      screen: 'movieStudio',
      selection: { type: 'projectInformation' },
    });
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
      if (url === '/studio-api/studio/events/focus-failures') {
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

  it('does not apply a startup pending focus request again when it appears in polling', async () => {
    let eventReadCount = 0;
    let validationCount = 0;
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
        validationCount += 1;
        return jsonResponse({ valid: true });
      }
      if (
        url === '/studio-api/studio/events/browser-sessions/active' ||
        url === '/studio-api/studio/events/focus-changes'
      ) {
        return jsonResponse({});
      }
      if (url === '/studio-api/studio/events/focus-failures') {
        return jsonResponse({});
      }
      if (url.startsWith('/studio-api/studio/events')) {
        eventReadCount += 1;
        return jsonResponse(
          eventReadCount === 1
            ? { events: [], nextCursor: '100', warnings: [] }
            : eventReadCount === 2
              ? {
                  events: [
                    {
                      id: 'studio_event_pending_focus',
                      type: 'studio.focusRequested',
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
                  ],
                  nextCursor: '200',
                  warnings: [],
                }
              : { events: [], nextCursor: '200', warnings: [] }
        );
      }
      return jsonResponse({});
    });

    renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/constantinople');
    });
    await screen.findByText('Project Name');
    await waitFor(() => {
      expect(eventReadCount).toBeGreaterThan(1);
    }, { timeout: 2_500 });
    expect(validationCount).toBe(1);
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

    const [projectInformationButton] =
      await screen.findAllByText('Project Information');
    fireEvent.click(projectInformationButton.closest('button')!);

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
  project?: ProjectShellWithHttp;
}): string[] {
  const fetchLog: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
    const url = requestUrl(request);
    fetchLog.push(url);
    if (url === '/studio-api/projects') {
      return jsonResponse({ library: input.library ?? makeLibrary([]) });
    }
    if (url === '/studio-api/projects/constantinople') {
      return jsonResponse({ project: input.project ?? makeProject() });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/movie-studio-selection/context'
    ) {
      const body = requestJsonBody<{ selection: StudioSelection }>(init);
      return jsonResponse(makeSelectionContextResponse(body.selection));
    }
    if (url === '/studio-api/projects/constantinople/sequences/seq_opening/scenes') {
      return jsonResponse({
        page: {
          items: [
            {
              id: 'scene_1_1',
              sequenceId: 'seq_opening',
              title: 'Opening Scene',
              clipCount: 1,
            },
          ],
          nextCursor: null,
        },
      });
    }
    if (url === '/studio-api/projects/constantinople/scenes/scene_1_1/clips') {
      return jsonResponse({
        page: {
          items: [
            {
              id: 'clip_1_1_1',
              sceneId: 'scene_1_1',
              title: 'Opening Image',
              oneLineSummary: 'Establish the movie.',
            },
          ],
          nextCursor: null,
        },
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/cast/cast_narrator/design?role=character_sheet'
    ) {
      return jsonResponse({ resource: makeCastDesignResource([makeCastAsset()]) });
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

function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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

function requestJsonBody<T>(init: RequestInit | undefined): T {
  return JSON.parse(String(init?.body ?? '{}')) as T;
}

function makeSelectionContextResponse(selection: StudioSelection) {
  if ('id' in selection && selection.id.includes('missing')) {
    return {
      valid: false,
      reason: 'selectionNotFound',
      diagnostics: [],
    };
  }
  if (selection.type === 'cast') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'cast-design',
        castMember: {
          id: selection.id,
          name: 'Narrator',
          kind: 'narrator',
          role: 'voiceover',
        },
      },
      resourceKeys: [`surface:cast-design:${selection.id}`],
    };
  }
  if (selection.type === 'sequence') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'sequence',
        sequence: {
          id: selection.id,
          number: 1,
          title: 'Opening',
          shortTitle: 'Opening',
          sceneCount: 1,
          clipCount: 1,
        },
      },
      resourceKeys: ['navigation:movie-sequences'],
    };
  }
  if (selection.type === 'scene') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'scene',
        sequence: {
          id: 'seq_opening',
          number: 1,
          title: 'Opening',
          shortTitle: 'Opening',
          sceneCount: 1,
          clipCount: 1,
        },
        scene: {
          id: selection.id,
          sequenceId: 'seq_opening',
          title: 'Opening Scene',
          clipCount: 1,
        },
      },
      resourceKeys: ['navigation:sequence-scenes:seq_opening'],
    };
  }
  if (selection.type === 'clip') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'clip-design',
        sequence: {
          id: 'seq_opening',
          number: 1,
          title: 'Opening',
          shortTitle: 'Opening',
          sceneCount: 1,
          clipCount: 1,
        },
        scene: {
          id: 'scene_1_1',
          sequenceId: 'seq_opening',
          title: 'Opening Scene',
          clipCount: 1,
        },
        clip: {
          id: selection.id,
          sceneId: 'scene_1_1',
          title: 'Opening Image',
          oneLineSummary: 'Establish the movie.',
        },
      },
      resourceKeys: ['surface:clip-design:clip_1_1_1'],
    };
  }
  return {
    valid: true,
    selection,
    context: { surface: 'project-information' },
    resourceKeys: ['project-information'],
  };
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
): ProjectShellWithHttp {
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
    navigation: makeProjectNavigation(),
  };
}

function makeProjectNavigation(): ProjectShellWithHttp['navigation'] {
  return {
    cast: {
      items: [
        {
          id: 'cast_narrator',
          name: 'Narrator',
          kind: 'narrator',
          role: 'voiceover',
        },
      ],
      nextCursor: null,
    },
    visualLanguage: { items: [], nextCursor: null },
    continuityReferences: { items: [], nextCursor: null },
    narrative: {
      projectType: 'standaloneMovie',
      sequences: {
        items: [
          {
            id: 'seq_opening',
            number: 1,
            title: 'Opening',
            shortTitle: 'Opening',
            sceneCount: 1,
            clipCount: 1,
          },
        ],
        nextCursor: null,
      },
    },
  };
}

function makeCastDesignResource(assets: StudioAssetResponse[]) {
  return {
    castMember: {
      id: 'cast_narrator',
      name: 'Narrator',
      kind: 'narrator',
      role: 'voiceover',
    },
    selectedAssets: assets.filter((asset) => asset.selection.kind === 'select'),
    activeTakePage: {
      items: assets.filter((asset) => asset.selection.kind === 'take'),
      nextCursor: null,
    },
    countsByRole: [],
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

function makeCastAsset(
  options: {
    assetId?: string;
    castMemberId?: string;
    title?: string;
  } = {}
): StudioAssetResponse {
  const assetId = options.assetId ?? 'asset_cast_reference';
  const castMemberId = options.castMemberId ?? 'cast_narrator';
  const title = options.title ?? 'Narrator reference';
  return {
    assetId,
    relationshipId: `${assetId}_relationship`,
    target: { kind: 'castMember', castMemberId },
    localeId: null,
    type: 'reference',
    selection: { kind: 'take' },
    availability: 'ready',
    mediaKind: 'image',
    title,
    oneLineSummary: null,
    origin: 'imported',
    role: 'reference',
    sortOrder: 1,
    files: [
      {
        id: `${assetId}_file`,
        role: 'primary',
        projectRelativePath:
          'working-assets/base/cast/narrator/reference.png' as StudioAssetResponse['files'][number]['projectRelativePath'],
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 12,
        contentHash: null,
        width: 1200,
        height: 900,
        durationSeconds: null,
      },
    ],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
  };
}
