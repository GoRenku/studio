// @vitest-environment jsdom
import React from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { ThemeProvider } from './theme-provider';
import type {
  ProjectLibraryWithHttp,
  ProjectShellWithHttp,
  StudioAssetResponse,
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

    fireEvent.click(
      await screen.findByRole('button', { name: 'Preparation of the Siege' })
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/projects/constantinople');
    });
    await screen.findByText('Project Name');
    await screen.findByText('Screenplay');
    expect(screen.getByRole('button', { name: 'AnalysisProject analysis documents' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Analysis' }));
    expect(screen.getByRole('button', { name: 'Screenplay Analysis' })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Visual Language' })
    );
    expect(
      screen.getByRole('button', { name: 'LookbooksProduction and Storyboard' })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'ProductionFinal video direction' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'StoryboardStoryboard direction' })
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Lookbooks' }));
    expect(
      screen.getAllByRole('button', { name: 'ProductionFinal video direction' })
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'StoryboardStoryboard direction' })
    ).toHaveLength(1);
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
        path: '/projects/constantinople/scenes',
        expectedText: 'Screenplay Analysis',
      },
      {
        path: '/projects/constantinople/screenplay',
        expectedText: 'Beat 1',
      },
      {
        path: '/projects/constantinople/scenes/scene_1_1',
        expectedText: 'Workers prepare the city walls before sunrise.',
      },
      {
        path: '/projects/constantinople/cast',
        expectedText: 'Narrator',
      },
      {
        path: '/projects/constantinople/cast/cast_narrator',
        expectedText: 'Details',
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

    await screen.findByText('Details');
    expect(fetchLog).toContain('/studio-api/projects/constantinople');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );
  });

  it('uses Sections only as expandable Screenplay navigation groups', async () => {
    window.history.pushState(
      {},
      '',
      '/projects/constantinople/screenplay'
    );
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    expect((await screen.findAllByText('Beat 1')).length).toBeGreaterThan(0);
    await screen.findByLabelText('Expand Opening');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/screenplay'
    );

    fireEvent.click(screen.getByRole('button', { name: /^Opening1 scene$/ }));
    expect(screen.getByLabelText('Collapse Opening')).not.toBeNull();
    expect(window.location.pathname).toBe(
      '/projects/constantinople/screenplay'
    );
  });

  it('opens a Scene directly from the scene-first sidebar', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    fireEvent.click(await screen.findByLabelText('Expand Screenplay'));
    fireEvent.click(await screen.findByLabelText('Expand Opening'));
    fireEvent.click(
      await screen.findByRole('button', { name: /Opening Scene/ })
    );
    await screen.findByText('Workers prepare the city walls before sunrise.');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/scenes/scene_1_1'
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

    await screen.findByText('Details');
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
    fireEvent.click(screen.getByLabelText('Expand Cast'));
    fireEvent.click(screen.getByText('Narrator'));
    await screen.findByText('Details');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/cast/cast_narrator'
    );

    window.history.back();
    fireEvent.popState(window);
    await screen.findByText('Project Name');
    expect(window.location.pathname).toBe('/projects/constantinople');

    window.history.forward();
    fireEvent.popState(window);
    await screen.findByText('Details');
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
    project.navigation.cast.items = [
      ...project.navigation.cast.items,
      {
        id: 'cast_mehmed',
        handle: 'mehmed',
        name: 'Mehmed',
        isVoiceOver: false,
        role: 'sultan',
      },
    ];
    project.project.counts.castMembers = 2;
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
        '/studio-api/projects/constantinople/continuity/cast/cast_narrator'
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
        url.startsWith(
          '/studio-api/projects/constantinople/cast/cast_narrator/assets'
        )
      ) {
        const asset = makeStudioAsset({
          assetId: 'asset_cast_narrator_profile',
          castMemberId: 'cast_narrator',
          role: 'profile',
          title: 'Narrator profile',
        });
        return jsonResponse({
          assets: [asset],
          page: { items: [asset], nextCursor: null },
        });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/continuity/cast/cast_mehmed'
      ) {
        return mehmedAssets.promise;
      }
      if (
        url.startsWith(
          '/studio-api/projects/constantinople/cast/cast_mehmed/assets'
        )
      ) {
        const asset = makeStudioAsset({
          assetId: 'asset_cast_mehmed_profile',
          castMemberId: 'cast_mehmed',
          role: 'profile',
          title: 'Mehmed profile',
        });
        return jsonResponse({
          assets: [asset],
          page: { items: [asset], nextCursor: null },
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

    await screen.findByText('Details');
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

    await screen.findByText('Mehmed anchors the audience point of view.');
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
        path: '/projects/constantinople/sections/section_missing',
        message:
          'Unknown project route: /projects/constantinople/sections/section_missing',
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

  it('rejects unknown Lookbook kinds instead of opening Production', async () => {
    window.history.pushState(
      {},
      '',
      '/projects/constantinople/visual-language/lookbooks/produciton'
    );
    mockStudioFetch({
      library: makeLibrary([makeProjectSummary()]),
      project: makeProject(),
    });

    renderApp();

    await screen.findByText('Project Library');
    expect(screen.getByText('Unknown Lookbook kind: produciton')).toBeTruthy();
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
    await screen.findByText('Screenplay');
    expect(selectWasCalled).toBe(false);
  });

  it.each([
    [
      'Project Information',
      { type: 'projectInformation' },
      '/projects/constantinople',
    ],
    [
      'Inspiration',
      { type: 'inspiration' },
      '/projects/constantinople/visual-language/inspiration',
    ],
    [
      'Production Lookbook',
      { type: 'lookbook', kind: 'production' },
      '/projects/constantinople/visual-language/lookbooks/production',
    ],
    [
      'Storyboard Lookbook',
      { type: 'lookbook', kind: 'storyboard' },
      '/projects/constantinople/visual-language/lookbooks/storyboard',
    ],
    ['Trash', { type: 'trash' }, '/projects/constantinople/trash'],
    ['Story Arc', { type: 'storyArc' }, '/projects/constantinople/scenes'],
    [
      'Screenplay',
      { type: 'screenplay' },
      '/projects/constantinople/screenplay',
    ],
    [
      'Scene',
      { type: 'scene', id: 'scene_1_1' },
      '/projects/constantinople/scenes/scene_1_1',
    ],
    [
      'Scene Beat',
      {
        type: 'scene',
        id: 'scene_1_1',
        sceneTab: 'beats',
        beatId: 'beat_001',
      },
      '/projects/constantinople/scenes/scene_1_1?sceneTab=beats&beat=beat_001',
    ],
    [
      'Scene Shot Plans',
      {
        type: 'scene',
        id: 'scene_1_1',
        sceneTab: 'shotPlans',
      },
      '/projects/constantinople/scenes/scene_1_1?sceneTab=shotPlans',
    ],
    [
      'Shot Plan detail',
      {
        type: 'scene',
        id: 'scene_1_1',
        sceneTab: 'shotPlans',
        shotPlanId: 'plan_001',
        shotId: 'shot_002',
      },
      '/projects/constantinople/scenes/scene_1_1?sceneTab=shotPlans&shotPlan=plan_001&shot=shot_002',
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
      expect(currentTestRoutePath()).toBe(expectedPath);
    }, { timeout: 2_500 });
    await waitFor(() => {
      expect(reportedAppliedRequestIds).toContain('studio_event_selection_focus');
    });
    expect(reportedAppliedFocuses).toContainEqual({
      screen: 'movieStudio',
      selection,
    });
  });

  it('clears a stale shot query when focus moves to the scene without a shot', async () => {
    window.history.pushState(
      {},
      '',
      '/projects/constantinople/scenes/scene_1_1?shot=shot_001'
    );
    const reportedAppliedRequestIds: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = requestUrl(input);
      if (url === '/studio-api/projects') {
        return jsonResponse({ library: makeLibrary([]) });
      }
      if (url === '/studio-api/projects/constantinople') {
        return jsonResponse({ project: makeProject() });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/movie-studio-selection/context'
      ) {
        const body = requestJsonBody<{ selection: StudioSelection }>(init);
        return jsonResponse(makeSelectionContextResponse(body.selection));
      }
      if (url === '/studio-api/projects/constantinople/screenplay/scenes/scene_1_1') {
        return jsonResponse({ resource: makeSceneNarrativeResource() });
      }
      if (
        url ===
        '/studio-api/projects/constantinople/screenplay/scenes/scene_1_1/beats'
      ) {
        return jsonResponse({ resource: makeSceneBeatsResource() });
      }
      if (url === '/studio-api/studio/events/current') {
        return jsonResponse({
          ...emptyStudioCurrent(),
          pendingRequest: {
            eventId: 'studio_event_scene_focus',
            createdAt: '2026-05-12T00:00:00.000Z',
            projectRef: {
              name: 'constantinople',
              id: 'project_test0001',
              storageRoot: '/tmp',
            },
            focus: {
              screen: 'movieStudio',
              selection: { type: 'scene', id: 'scene_1_1' },
            },
          },
        });
      }
      if (url === '/studio-api/studio/events/focus-requests/validate') {
        return jsonResponse({ valid: true });
      }
      if (url === '/studio-api/studio/events/focus-changes') {
        const body = requestJsonBody<{ appliedRequestId?: string }>(init);
        if (body.appliedRequestId) {
          reportedAppliedRequestIds.push(body.appliedRequestId);
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
      expect(currentTestRoutePath()).toBe(
        '/projects/constantinople/scenes/scene_1_1'
      );
    }, { timeout: 2_500 });
    await waitFor(() => {
      expect(reportedAppliedRequestIds).toContain('studio_event_scene_focus');
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
    expect(screen.getAllByText('Screenplay').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cast').length).toBeGreaterThan(0);
  });

  it('opens URL-owned Props overview and detail surfaces from the sidebar', async () => {
    window.history.pushState({}, '', '/projects/constantinople/props');
    const project = makeProject();
    project.project.counts.props = 1;
    project.navigation.props.items = [
      {
        id: 'prop_cannon',
        handle: 'field-cannon',
        name: 'Field Cannon',
      },
    ];
    mockStudioFetch({ project });

    renderApp();

    const card = await screen.findByRole('button', { name: 'Field Cannon' });
    fireEvent.click(card);
    await screen.findByText('Details');
    expect(window.location.pathname).toBe(
      '/projects/constantinople/props/prop_cannon'
    );
    expect(screen.getByText('No prop hero image yet')).toBeTruthy();
  });

  it('opens Project Information for projects without cover images', async () => {
    window.history.pushState({}, '', '/projects/constantinople');
    mockStudioFetch({ project: makeProject({ coverUrl: null }) });

    renderApp();

    const [projectInformationButton] =
      await screen.findAllByText('Project Details');
    fireEvent.click(projectInformationButton.closest('button')!);

    expect(screen.getByText('Project Name')).toBeTruthy();
    expect(screen.getByText('constantinople')).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Project Info' }).getAttribute(
        'aria-selected'
      )
    ).toBe('true');
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeTruthy();
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
    if (
      url ===
      '/studio-api/projects/constantinople/continuity/cast'
    ) {
      return jsonResponse({
        resource: {
          cast: {
            items: [
              {
                id: 'cast_narrator',
                handle: 'narrator',
                name: 'Narrator',
                isVoiceOver: true,
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
      '/studio-api/projects/constantinople/continuity/cast/cast_narrator'
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
      url.startsWith(
        '/studio-api/projects/constantinople/cast/cast_narrator/assets'
      )
    ) {
      const asset = makeStudioAsset({
        assetId: 'asset_cast_narrator_profile',
        castMemberId: 'cast_narrator',
        role: 'profile',
        title: 'Narrator profile',
      });
      return jsonResponse({
        assets: [asset],
        page: { items: [asset], nextCursor: null },
      });
    }
    if (url === '/studio-api/projects/constantinople/continuity/locations') {
      return jsonResponse({
        resource: {
          locations: { items: [], nextCursor: null },
        },
      });
    }
    if (url === '/studio-api/projects/constantinople/continuity/props') {
      return jsonResponse({
        resource: {
          props: {
            items: input.project?.navigation.props.items ?? [],
            nextCursor: null,
          },
        },
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/continuity/props/prop_cannon'
    ) {
      return jsonResponse({
        resource: {
          prop: {
            id: 'prop_cannon',
            handle: 'field-cannon',
            name: 'Field Cannon',
            description: 'A monumental bronze siege cannon.',
          },
        },
      });
    }
    if (
      url.startsWith(
        '/studio-api/projects/constantinople/props/prop_cannon/assets'
      )
    ) {
      return jsonResponse({
        assets: [],
        page: {
          items: [],
          nextCursor: null,
          selectedAssetId: null,
        },
      });
    }
    if (url === '/studio-api/projects/constantinople/screenplay/story-arc') {
      return jsonResponse({
        resource: makeStoryArcResource(),
      });
    }
    if (url === '/studio-api/projects/constantinople/screenplay/beat-gallery') {
      return jsonResponse({
        resource: makeScreenplayBeatGalleryResource(),
      });
    }
    if (url === '/studio-api/projects/constantinople/screenplay/scenes/scene_1_1') {
      return jsonResponse({
        resource: makeSceneNarrativeResource(),
      });
    }
    if (
      url ===
      '/studio-api/projects/constantinople/screenplay/scenes/scene_1_1/dialogue-turns/audio'
    ) {
      return jsonResponse({
        context: {
          sceneId: 'scene_1_1',
          projectName: 'constantinople',
          audioByTurnId: {},
        },
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

function currentTestRoutePath(): string {
  return `${window.location.pathname}${window.location.search}`;
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
          isVoiceOver: true,
          role: 'voiceover',
        },
      },
      resourceKeys: [`surface:castMember:${selection.id}`],
    };
  }
  if (selection.type === 'prop') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'prop',
        prop: {
          id: selection.id,
          handle: 'field-cannon',
          name: 'Field Cannon',
        },
      },
      resourceKeys: [`surface:prop:${selection.id}`],
    };
  }
  if (selection.type === 'screenplay') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'screenplay',
      },
      resourceKeys: ['screenplay:structure'],
    };
  }
  if (selection.type === 'scene') {
    return {
      valid: true,
      selection,
      context: {
        surface: 'scene',
        scene: {
          scene: {
            id: selection.id,
            productionNumber: '1',
            heading: 'EXT. THEODOSIAN WALLS - DAWN',
            title: 'Opening Scene',
            blocks: [],
          },
          references: [],
        },
      },
      resourceKeys: [`scene:${selection.id}`],
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
    project: {
      id: 'project_test0001',
      projectName: 'constantinople',
      title: 'Preparation of the Siege',
      aspectRatio: '16:9',
      coverImage: coverUrl ? { fileName: 'cover.png' } : null,
      counts: {
        languages: 0,
        castMembers: 1,
        locations: 0,
        props: 0,
        acts: 1,
        sequences: 1,
        scenes: 1,
      },
    },
    coverUrl,
    storageRoot: '/tmp/renku-studio',
    languages: [],
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
          isVoiceOver: true,
          role: 'voiceover',
        },
      ],
      nextCursor: null,
    },
    locations: { items: [], nextCursor: null },
    props: { items: [], nextCursor: null },
    screenplay: {
      screenplay: {
        opening: [],
        sections: [
          {
            id: 'section_opening',
            type: 'sequence',
            title: 'Opening',
          },
        ],
        scenes: [
          {
            id: 'scene_1_1',
            productionNumber: '1',
            heading: 'EXT. THEODOSIAN WALLS - DAWN',
            title: 'Opening Scene',
            blocks: [],
          },
        ],
        structure: [
          {
            id: 'entry_section_opening',
            content: { type: 'section', sectionId: 'section_opening' },
            position: 0,
          },
          {
            id: 'entry_scene_1_1',
            parentSectionId: 'section_opening',
            content: { type: 'scene', sceneId: 'scene_1_1' },
            position: 0,
          },
        ],
        references: [],
      },
      orderedSceneIds: ['scene_1_1'],
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
      isVoiceOver: options.castMemberId ? false : true,
      role: options.role,
      arc: 'Learns how to frame the siege as a human story.',
      description: `${options.name ?? 'Narrator'} anchors the audience point of view.`,
      voiceNotes: 'Measured, observant, and precise.',
    },
    firstImage: makeScreenplayImageReference({
      assetId: `asset_${castMemberId}_reference`,
      title: options.firstImageTitle ?? options.title ?? 'Narrator reference',
    }),
    voices: [],
  };
}

function makeStoryArcResource() {
  return {
    project: {
      title: 'Preparation of the Siege',
      logline: 'A documentary about preparation before 1453.',
    },
    scenes: [
      {
        id: 'scene_1_1',
        productionNumber: '1',
        heading: 'EXT. THEODOSIAN WALLS - DAWN',
        title: 'Opening Scene',
      },
    ],
    activeAnalysis: null,
    activeAnalysisFreshness: 'current',
    needsRefresh: false,
    freshnessHelp: null,
  };
}

function makeScreenplayBeatGalleryResource() {
  return {
    projectAspectRatio: '16:9',
    scenes: [
      {
        scene: {
          id: 'scene_1_1',
          productionNumber: '1',
          heading: 'EXT. THEODOSIAN WALLS - DAWN',
          title: 'Opening Scene',
        },
        beats: [
          {
            beat: { id: 'beat_001', number: '1', title: 'Beat 1' },
            image: makeScreenplayImageReference({
              assetId: 'asset_beat_001',
              title: 'Beat 1 image',
            }),
          },
        ],
      },
    ],
  };
}

function makeSceneNarrativeResource() {
  return {
    scene: {
      id: 'scene_1_1',
      productionNumber: '1',
      heading: 'EXT. THEODOSIAN WALLS - DAWN',
      title: 'Opening Scene',
      blocks: [
        {
          id: 'block_opening_action',
          type: 'action',
          text: 'Workers prepare the city walls before sunrise.',
        },
      ],
    },
    references: [],
  };
}

function makeSceneBeatsResource() {
  return {
    scene: {
      id: 'scene_1_1',
      sequenceId: 'seq_opening',
      productionNumber: '1',
      title: 'Opening Scene',
    },
    sequence: {
      id: 'seq_opening',
      actId: 'act_opening',
      number: 1,
      title: 'Opening',
      sceneCount: 1,
    },
    act: {
      id: 'act_opening',
      title: 'Opening Act',
      sequenceCount: 1,
      sceneCount: 1,
    },
    projectAspectRatio: '16:9',
    activeRevisionId: null,
    activeRevision: null,
    storyboardImagesByBeatId: {},
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
  };
}

function makeScreenplayImageReference(
  options: {
    assetId?: string;
    assetFileId?: string;
    title?: string;
  } = {}
) {
  const assetId = options.assetId ?? 'asset_cast_reference';
  return {
    assetId,
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

function makeStudioAsset(options: {
  assetId: string;
  castMemberId: string;
  role: string;
  title: string;
}): StudioAssetResponse {
  return {
    id: options.assetId,
    owner: { kind: 'castMember', id: options.castMemberId },
    localeId: null,
    type: options.role === 'profile' ? 'cast_profile' : 'character_sheet',
    availability: 'ready',
    mediaKind: 'image',
    title: options.title,
    oneLineSummary: null,
    origin: 'imported',
    referenceName: null,
    tags: [],
    files: [
      {
        id: `${options.assetId}_file`,
        role: 'primary',
        url: `/studio-api/projects/constantinople/assets/${options.assetId}/files/${options.assetId}_file`,
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 12,
        contentHash: null,
        width: 1024,
        height: 1024,
        durationSeconds: null,
      },
    ],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
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
    projectName: 'constantinople',
    title: 'Preparation of the Siege',
    folderPath: '/tmp/constantinople',
    coverImage: { fileName: 'cover.png' },
    coverUrl: '/studio-api/projects/constantinople/cover',
    logline: 'A documentary about preparation before 1453.',
    counts: {
      languages: 0,
      castMembers: 1,
      locations: 0,
      props: 0,
      acts: 1,
      sequences: 1,
      scenes: 1,
    },
    validationError: null,
  };
}
