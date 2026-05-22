// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { ThemeProvider } from './theme-provider';
import type {
  ProjectLibraryWithHttp,
  ProjectShellWithHttp,
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
    await screen.findByText('Acts');
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
        path: '/projects/constantinople/acts',
        expectedText: 'Story Arc',
      },
      {
        path: '/projects/constantinople/sequences/seq_opening',
        expectedText: 'Opening Scene',
      },
      {
        path: '/projects/constantinople/scenes/scene_1_1',
        expectedText: 'Opening Scene',
      },
      {
        path: '/projects/constantinople/cast',
        expectedText: 'Narrator',
      },
      {
        path: '/projects/constantinople/cast/cast_narrator',
        expectedText: 'Voice Design',
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

    await screen.findByText('Voice Design');
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
        screenplay: {
          acts: { items: [], nextCursor: 'after-first-page' },
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
              actId: 'act_late',
              number: 150,
              title: 'Late Sequence',
              sceneCount: 0,
            },
            act: {
              id: 'act_late',
              title: 'Late Act',
              sequenceCount: 1,
              sceneCount: 0,
            },
          },
          resourceKeys: ['navigation:movie-sequences'],
        });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/screenplay/sequences/seq_late'
      ) {
        return jsonResponse({
          resource: makeSequenceResource({
            actId: 'act_late',
            actTitle: 'Late Act',
            sequenceId: 'seq_late',
            sequenceTitle: 'Late Sequence',
            scenes: [],
          }),
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

  it('loads a direct scene route through selection context without eager shell children', async () => {
    const project = {
      ...makeProject(),
      navigation: {
        ...makeProjectNavigation(),
        screenplay: {
          acts: { items: [], nextCursor: 'after-first-page' },
        },
      },
    };
    window.history.pushState({}, '', '/projects/constantinople/scenes/scene_late');
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
          selection: { type: 'scene', id: 'scene_late' },
          context: {
            surface: 'scene',
            sequence: {
              id: 'seq_late',
              actId: 'act_late',
              number: 150,
              title: 'Late Sequence',
              sceneCount: 1,
            },
            act: {
              id: 'act_late',
              title: 'Late Act',
              sequenceCount: 1,
              sceneCount: 1,
            },
            scene: {
              id: 'scene_late',
              sequenceId: 'seq_late',
              title: 'Late Scene',
            },
          },
          resourceKeys: ['navigation:sequence-scenes:seq_late'],
        });
      }
      if (url === '/studio-api/projects/constantinople/screenplay/scenes/scene_late') {
        return jsonResponse({
          resource: makeSceneNarrativeResource({
            sceneId: 'scene_late',
            sceneTitle: 'Late Scene',
            sequenceId: 'seq_late',
            sequenceTitle: 'Late Sequence',
            actId: 'act_late',
            actTitle: 'Late Act',
          }),
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

    await screen.findByRole('heading', { name: 'Late Scene' });
    expect(window.location.pathname).toBe('/projects/constantinople/scenes/scene_late');
  });

  it('loads sequence scenes through navigation pages', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    const fetchLog = mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Acts');
    fireEvent.click(screen.getByLabelText('Expand Acts'));
    await screen.findByText('Opening Act');
    fireEvent.click(screen.getByText('Opening Act'));
    await screen.findByText('Opening');
    fireEvent.click(screen.getByLabelText('Expand Opening'));

    await screen.findByText('Opening Scene');
    expect(screen.getByText('1 scenes')).toBeTruthy();
    expect(fetchLog).toContain(
      '/studio-api/projects/constantinople/screenplay/sequences/seq_opening/scenes'
    );
  });

  it('updates the URL when a cast member is selected from the sidebar', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Cast');
    fireEvent.click(screen.getByLabelText('Expand Cast'));
    fireEvent.click(screen.getByText('Narrator'));

    await screen.findByText('Voice Design');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );
  });

  it('exports production assets from the sidebar header action', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    const fetchLog = mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Project Name');
    fireEvent.click(screen.getByLabelText('Export production assets'));

    await waitFor(() => {
      expect(fetchLog).toContain(
        '/studio-api/projects/constantinople/production-export'
      );
    });
  });

  it('uses browser history to restore route-owned Movie Studio selections', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Project Name');
    fireEvent.click(screen.getByLabelText('Expand Cast'));
    fireEvent.click(screen.getByText('Narrator'));
    await screen.findByText('Voice Design');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );

    window.history.back();
    fireEvent.popState(window);
    await screen.findByText('Project Name');
    expect(window.location.pathname).toBe('/projects/constantinople');

    window.history.forward();
    fireEvent.popState(window);
    await screen.findByText('Voice Design');
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
        handle: 'mehmed',
        name: 'Mehmed',
        role: 'sultan',
      },
    ];
    project.navigation.cast.items = [
      ...project.navigation.cast.items,
      {
        id: 'cast_mehmed',
        handle: 'mehmed',
        name: 'Mehmed',
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
        '/studio-api/projects/constantinople/screenplay/cast/cast_narrator'
      ) {
        return jsonResponse({
          resource: makeCastMemberResource({
            castMemberId: 'cast_narrator',
            name: 'Narrator',
            role: 'voiceover',
            firstImageTitle: 'Narrator reference',
          }),
        });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/screenplay/cast/cast_mehmed'
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

    await screen.findByText('Voice Design');
    fireEvent.click(await screen.findByText('Mehmed'));

    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_mehmed'
    );
    expect(screen.queryByText('Loading Renku Studio...')).toBeNull();
    expect(screen.getByText('Loading cast member...')).toBeTruthy();
    expect(projectReadCount).toBe(1);

    mehmedAssets.resolve(
      jsonResponse({
        resource: makeCastMemberResource({
            castMemberId: 'cast_mehmed',
            name: 'Mehmed',
            role: 'sultan',
            title: 'Mehmed reference',
        }),
      })
    );

    await screen.findByAltText('Mehmed');
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
    await screen.findByText('Acts');
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
    ['Story Arc', { type: 'storyArc' }, '/projects/constantinople/acts'],
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
    ['Cast overview', { type: 'cast' }, '/projects/constantinople/cast'],
    [
      'Cast member',
      { type: 'castMember', id: 'cast_narrator' },
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
                      selection: { type: 'storyArc' },
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
    expect(screen.getAllByText('Acts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cast').length).toBeGreaterThan(0);
  });

  it('opens Project Information for projects without cover images', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({ project: makeProject({ coverUrl: null }) });

    renderApp();

    const [projectInformationButton] =
      await screen.findAllByText('Project Details');
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
    if (url === '/studio-api/projects/constantinople/production-export') {
      return jsonResponse({
        summary: {
          copiedFileCount: 1,
          skippedFileCount: 0,
          prunedFileCount: 0,
          unmanagedFileCount: 0,
          variants: [],
        },
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/movie-studio-selection/context'
    ) {
      const body = requestJsonBody<{ selection: StudioSelection }>(init);
      return jsonResponse(makeSelectionContextResponse(body.selection));
    }
    if (
      url ===
      '/studio-api/projects/constantinople/screenplay/acts/act_opening/sequences'
    ) {
      return jsonResponse({
        page: {
          items: [
            {
              id: 'seq_opening',
              actId: 'act_opening',
              number: 1,
              title: 'Opening',
              purpose: 'Establish the siege preparations.',
              sceneCount: 1,
            },
          ],
          nextCursor: null,
        },
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/screenplay/sequences/seq_opening/scenes'
    ) {
      return jsonResponse({
        page: {
          items: [
            {
              id: 'scene_1_1',
              sequenceId: 'seq_opening',
              title: 'Opening Scene',
              setting: {
                interiorExterior: 'EXT',
                locationIds: [],
                timeOfDay: 'DAY',
              },
            },
          ],
          nextCursor: null,
        },
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/screenplay/cast'
    ) {
      return jsonResponse({
        resource: {
          cast: {
            items: [
              {
                id: 'cast_narrator',
                handle: 'narrator',
                name: 'Narrator',
                role: 'voiceover',
                firstImage: makeScreenplayImageReference({
                  title: 'Narrator reference',
                }),
              },
            ],
            nextCursor: null,
          },
        },
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/screenplay/cast/cast_narrator'
    ) {
      return jsonResponse({
        resource: makeCastMemberResource({
          castMemberId: 'cast_narrator',
          name: 'Narrator',
          role: 'voiceover',
          firstImageTitle: 'Narrator reference',
        }),
      });
    }
    if (url === '/studio-api/projects/constantinople/screenplay/locations') {
      return jsonResponse({
        resource: {
          locations: { items: [], nextCursor: null },
        },
      });
    }
    if (url === '/studio-api/projects/constantinople/screenplay/story-arc') {
      return jsonResponse({
        resource: makeStoryArcResource(),
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/screenplay/sequences/seq_opening'
    ) {
      return jsonResponse({
        resource: makeSequenceResource(),
      });
    }
    if (url === '/studio-api/projects/constantinople/screenplay/scenes/scene_1_1') {
      return jsonResponse({
        resource: makeSceneNarrativeResource(),
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
  if (selection.type === 'castMember') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'cast-member',
        castMember: {
          id: selection.id,
          handle: 'narrator',
          name: 'Narrator',
          role: 'voiceover',
        },
      },
      resourceKeys: [`surface:castMember:${selection.id}`],
    };
  }
  if (selection.type === 'sequence') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'sequence',
        act: {
          id: 'act_opening',
          title: 'Opening Act',
          sequenceCount: 1,
          sceneCount: 1,
        },
        sequence: {
          id: selection.id,
          actId: 'act_opening',
          number: 1,
          title: 'Opening',
          shortTitle: 'Opening',
          sceneCount: 1,
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
        act: {
          id: 'act_opening',
          title: 'Opening Act',
          sequenceCount: 1,
          sceneCount: 1,
        },
        sequence: {
          id: 'seq_opening',
          actId: 'act_opening',
          number: 1,
          title: 'Opening',
          shortTitle: 'Opening',
          sceneCount: 1,
        },
        scene: {
          id: selection.id,
          sequenceId: 'seq_opening',
          title: 'Opening Scene',
        },
      },
      resourceKeys: ['navigation:sequence-scenes:seq_opening'],
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
        handle: 'narrator',
        name: 'Narrator',
        role: 'voiceover',
      },
    ],
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      locations: 0,
      acts: 1,
      sequences: 1,
      scenes: 1,
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
          handle: 'narrator',
          name: 'Narrator',
          role: 'voiceover',
        },
      ],
      nextCursor: null,
    },
    visualLanguage: { items: [], nextCursor: null },
    locations: { items: [], nextCursor: null },
    screenplay: {
      acts: {
        items: [
          {
            id: 'act_opening',
            title: 'Opening Act',
            sequenceCount: 1,
            sceneCount: 1,
          },
        ],
        nextCursor: null,
      },
    },
  };
}

function makeCastMemberResource(options: {
  castMemberId?: string;
  name?: string;
  role?: string;
  firstImageTitle?: string;
  title?: string;
}) {
  const castMemberId = options.castMemberId ?? 'cast_narrator';
  return {
    castMember: {
      id: castMemberId,
      handle: castMemberId.replace(/^cast_/, ''),
      name: options.name ?? 'Narrator',
      role: options.role,
      arc: 'Learns how to frame the siege as a human story.',
      description: `${options.name ?? 'Narrator'} anchors the audience point of view.`,
      voiceNotes: 'Measured, observant, and precise.',
    },
    firstImage: makeScreenplayImageReference({
      assetId: `asset_${castMemberId}_reference`,
      title: options.firstImageTitle ?? options.title ?? 'Narrator reference',
    }),
  };
}

function makeStoryArcResource() {
  return {
    screenplay: {
      title: 'Preparation of the Siege',
      logline: 'A documentary about preparation before 1453.',
      dramaticQuestion: 'Can the city withstand the siege?',
      premiseOverview: 'A city and an army prepare for a decisive confrontation.',
      centralConflict: 'Defenders and attackers make irreversible choices.',
      summary: 'The story follows the pressure building before the fall.',
      storyArc: 'Preparation, pressure, confrontation.',
    },
    acts: [
      {
        id: 'act_opening',
        title: 'Opening Act',
        sequenceCount: 1,
        sceneCount: 1,
        sequences: [
          {
            id: 'seq_opening',
            actId: 'act_opening',
            number: 1,
            title: 'Opening',
            purpose: 'Establish the siege preparations.',
            sceneCount: 1,
          },
        ],
      },
    ],
  };
}

function makeSequenceResource(
  options: {
    actId?: string;
    actTitle?: string;
    sequenceId?: string;
    sequenceTitle?: string;
    scenes?: Array<{
      id: string;
      sequenceId: string;
      title: string;
    }>;
  } = {}
) {
  const actId = options.actId ?? 'act_opening';
  const sequenceId = options.sequenceId ?? 'seq_opening';
  const scenes =
    options.scenes ??
    [
      {
        id: 'scene_1_1',
        sequenceId,
        title: 'Opening Scene',
        setting: {
          interiorExterior: 'EXT',
          locationIds: [],
          timeOfDay: 'DAY',
        },
      },
    ];
  return {
    act: {
      id: actId,
      title: options.actTitle ?? 'Opening Act',
      sequenceCount: 1,
      sceneCount: scenes.length,
    },
    sequence: {
      id: sequenceId,
      actId,
      number: 1,
      title: options.sequenceTitle ?? 'Opening',
      purpose: 'Establish the siege preparations.',
      sceneCount: scenes.length,
    },
    scenes: {
      items: scenes,
      nextCursor: null,
    },
  };
}

function makeSceneNarrativeResource(
  options: {
    sceneId?: string;
    sceneTitle?: string;
    sequenceId?: string;
    sequenceTitle?: string;
    actId?: string;
    actTitle?: string;
  } = {}
) {
  const actId = options.actId ?? 'act_opening';
  const sequenceId = options.sequenceId ?? 'seq_opening';
  const sceneId = options.sceneId ?? 'scene_1_1';
  return {
    act: {
      id: actId,
      title: options.actTitle ?? 'Opening Act',
      sequenceCount: 1,
      sceneCount: 1,
    },
    sequence: {
      id: sequenceId,
      actId,
      number: 1,
      title: options.sequenceTitle ?? 'Opening',
      purpose: 'Establish the siege preparations.',
      sceneCount: 1,
    },
    scene: {
      id: sceneId,
      sequenceId,
      title: options.sceneTitle ?? 'Opening Scene',
      setting: {
        interiorExterior: 'EXT',
        locationIds: [],
        timeOfDay: 'DAY',
      },
    },
    blocks: [
      {
        type: 'action',
        text: 'Workers prepare the city walls before sunrise.',
      },
    ],
    castMemberLabels: {
      cast_narrator: 'Narrator',
    },
    locationLabels: {},
  };
}

function makeScreenplayImageReference(
  options: {
    assetId?: string;
    relationshipId?: string;
    assetFileId?: string;
    title?: string;
  } = {}
) {
  const assetId = options.assetId ?? 'asset_cast_reference';
  return {
    assetId,
    relationshipId: options.relationshipId ?? `${assetId}_relationship`,
    assetFileId: options.assetFileId ?? `${assetId}_file`,
    title: options.title ?? 'Narrator reference',
    fileRole: 'primary',
    mediaKind: 'image',
    mimeType: 'image/png',
    width: 1200,
    height: 900,
    url: `/studio-api/assets/${assetId}`,
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
    folderPath: '/tmp/constantinople',
    coverImage: { fileName: 'cover.png' },
    coverUrl: '/studio-api/projects/constantinople/cover',
    logline: 'A documentary about preparation before 1453.',
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      locations: 0,
      acts: 1,
      sequences: 1,
      scenes: 1,
    },
    validationError: null,
  };
}
