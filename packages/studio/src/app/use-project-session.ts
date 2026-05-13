import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readProject,
  readProjectLibrary,
} from '@/services/studio-projects-api';
import type {
  ProjectLibraryWithHttp,
  ProjectWithHttp,
} from '@/services/studio-project-contracts';
import type { MovieStudioSelection } from '@/features/movie-studio/movie-studio-selection';

type StudioRoute =
  | { screen: 'projectLibrary' }
  | {
      screen: 'movieStudio';
      projectName: string;
      selection: MovieStudioSelection;
      routeError?: string;
    };

export interface ProjectSession {
  project: ProjectWithHttp | null;
  library: ProjectLibraryWithHttp | null;
  isLoadingProjectRoute: boolean;
  isLoadingProjectLibrary: boolean;
  isSelectingProject: boolean;
  projectSessionError: string | null;
  movieStudioRouteSelection: MovieStudioSelection | null;
  refreshProjectLibrary: () => Promise<void>;
  refreshProject: (projectName: string) => Promise<ProjectWithHttp>;
  navigateToProject: (projectName: string) => Promise<ProjectWithHttp | null>;
  navigateToMovieStudioSelectionRoute: (
    selection: MovieStudioSelection,
    projectName?: string
  ) => Promise<{ routeChanged: boolean }>;
  updateCurrentProject: (project: ProjectWithHttp) => void;
  returnToProjectLibrary: () => void;
}

export function useProjectSession(): ProjectSession {
  const [project, setProject] = useState<ProjectWithHttp | null>(null);
  const [library, setLibrary] = useState<ProjectLibraryWithHttp | null>(null);
  const [isLoadingProjectRoute, setIsLoadingProjectRoute] = useState(true);
  const [isLoadingProjectLibrary, setIsLoadingProjectLibrary] = useState(false);
  const [isSelectingProject, setIsSelectingProject] = useState(false);
  const [projectSessionError, setProjectSessionError] = useState<string | null>(
    null
  );
  const [route, setRoute] = useState(readStudioRoute);
  const prefetchedProjectRef = useRef<ProjectWithHttp | null>(null);
  const currentProjectRef = useRef<ProjectWithHttp | null>(null);

  useEffect(() => {
    currentProjectRef.current = project;
  }, [project]);

  const refreshProjectLibrary = useCallback(async () => {
    setIsLoadingProjectLibrary(true);
    setProjectSessionError(null);
    try {
      setLibrary(await readProjectLibrary());
    } catch (libraryError) {
      setProjectSessionError(
        libraryError instanceof Error
          ? libraryError.message
          : 'Unable to load project library.'
      );
    } finally {
      setIsLoadingProjectLibrary(false);
    }
  }, []);

  const refreshProject = useCallback(async (projectName: string) => {
    const nextProject = await readProject(projectName);
    setProject(nextProject);
    return nextProject;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      if (route.screen === 'movieStudio') {
        const currentProject = currentProjectRef.current;
        if (currentProject?.identity.name === route.projectName) {
          try {
            validateRouteSelection(currentProject, route);
            setProjectSessionError(null);
          } catch (routeError) {
            if (!cancelled) {
              setProject(null);
              await refreshProjectLibrary();
              setProjectSessionError(
                routeError instanceof Error
                  ? routeError.message
                  : 'Unable to load project.'
              );
            }
          } finally {
            if (!cancelled) {
              setIsLoadingProjectRoute(false);
              setIsSelectingProject(false);
            }
          }
          return;
        }
      }

      setIsLoadingProjectRoute(true);
      setProjectSessionError(null);
      try {
        if (route.screen === 'projectLibrary') {
          setProject(null);
          await refreshProjectLibrary();
          return;
        }

        const prefetchedProject = prefetchedProjectRef.current;
        prefetchedProjectRef.current = null;
        const nextProject =
          prefetchedProject?.identity.name === route.projectName
            ? prefetchedProject
            : await readProject(route.projectName);
        validateRouteSelection(nextProject, route);
        if (!cancelled) {
          setProject(nextProject);
          setIsSelectingProject(false);
        }
      } catch (routeError) {
        if (!cancelled) {
          setProject(null);
          if (route.screen === 'movieStudio') {
            await refreshProjectLibrary();
          }
          setProjectSessionError(
            routeError instanceof Error
              ? routeError.message
              : 'Unable to load project.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProjectRoute(false);
          setIsSelectingProject(false);
        }
      }
    }

    void loadRoute();

    return () => {
      cancelled = true;
    };
  }, [refreshProjectLibrary, route]);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(readStudioRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToProject = useCallback(async (projectName: string) => {
    setIsSelectingProject(true);
    setIsLoadingProjectRoute(true);
    setProjectSessionError(null);
    try {
      const nextProject = await readProject(projectName);
      prefetchedProjectRef.current = nextProject;
      setProject(nextProject);
      pushRoutePath(projectRoutePath(projectName));
      setRoute({
        screen: 'movieStudio',
        projectName,
        selection: { type: 'projectInformation' },
      });
      return nextProject;
    } catch (navigationError) {
      setProjectSessionError(
        navigationError instanceof Error
          ? navigationError.message
          : 'Unable to open project.'
      );
      setIsLoadingProjectRoute(false);
      setIsSelectingProject(false);
      return null;
    }
  }, []);

  const navigateToMovieStudioSelectionRoute = useCallback(
    async (selection: MovieStudioSelection, requestedProjectName?: string) => {
      const projectName =
        requestedProjectName ??
        project?.identity.name ??
        (route.screen === 'movieStudio' ? route.projectName : null);
      if (!projectName) {
        return { routeChanged: false };
      }
      const path = movieStudioSelectionRoutePath(projectName, selection);
      if (
        window.location.pathname === path &&
        route.screen === 'movieStudio' &&
        route.projectName === projectName &&
        movieStudioSelectionKey(route.selection) === movieStudioSelectionKey(selection)
      ) {
        return { routeChanged: false };
      }
      pushRoutePath(path);
      setRoute({
        screen: 'movieStudio',
        projectName,
        selection,
      });
      return { routeChanged: true };
    },
    [project, route]
  );

  const returnToProjectLibrary = useCallback(() => {
    setProject(null);
    setProjectSessionError(null);
    pushRoutePath('/');
    setRoute({ screen: 'projectLibrary' });
  }, []);

  const updateCurrentProject = useCallback((nextProject: ProjectWithHttp) => {
    setProject(nextProject);
  }, []);

  return {
    project,
    library,
    isLoadingProjectRoute,
    isLoadingProjectLibrary,
    isSelectingProject,
    projectSessionError,
    movieStudioRouteSelection:
      route.screen === 'movieStudio' ? route.selection : null,
    refreshProjectLibrary,
    refreshProject,
    navigateToProject,
    navigateToMovieStudioSelectionRoute,
    updateCurrentProject,
    returnToProjectLibrary,
  };
}

function readStudioRoute(): StudioRoute {
  const projectInformationRoute = /^\/projects\/([^/]+)\/?$/.exec(
    window.location.pathname
  );
  if (projectInformationRoute?.[1]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(projectInformationRoute[1]),
      selection: { type: 'projectInformation' },
    };
  }

  const visualLanguageRoute = /^\/projects\/([^/]+)\/visual-language\/?$/.exec(
    window.location.pathname
  );
  if (visualLanguageRoute?.[1]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(visualLanguageRoute[1]),
      selection: { type: 'visualLanguage' },
    };
  }

  const storyboardRoute = /^\/projects\/([^/]+)\/storyboard\/?$/.exec(
    window.location.pathname
  );
  if (storyboardRoute?.[1]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(storyboardRoute[1]),
      selection: { type: 'storyboard' },
    };
  }

  const sequenceRoute = /^\/projects\/([^/]+)\/sequences\/([^/]+)\/?$/.exec(
    window.location.pathname
  );
  if (sequenceRoute?.[1] && sequenceRoute[2]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(sequenceRoute[1]),
      selection: { type: 'sequence', id: decodeURIComponent(sequenceRoute[2]) },
    };
  }

  const sceneRoute = /^\/projects\/([^/]+)\/scenes\/([^/]+)\/?$/.exec(
    window.location.pathname
  );
  if (sceneRoute?.[1] && sceneRoute[2]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(sceneRoute[1]),
      selection: { type: 'scene', id: decodeURIComponent(sceneRoute[2]) },
    };
  }

  const clipRoute = /^\/projects\/([^/]+)\/clips\/([^/]+)\/?$/.exec(
    window.location.pathname
  );
  if (clipRoute?.[1] && clipRoute[2]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(clipRoute[1]),
      selection: { type: 'clip', id: decodeURIComponent(clipRoute[2]) },
    };
  }

  const castRoute = /^\/projects\/([^/]+)\/cast\/([^/]+)\/?$/.exec(
    window.location.pathname
  );
  if (castRoute?.[1] && castRoute[2]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(castRoute[1]),
      selection: { type: 'cast', id: decodeURIComponent(castRoute[2]) },
    };
  }

  const castOverviewRoute = /^\/projects\/([^/]+)\/cast\/?$/.exec(
    window.location.pathname
  );
  if (castOverviewRoute?.[1]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(castOverviewRoute[1]),
      selection: { type: 'casting' },
    };
  }

  const unknownProjectRoute = /^\/projects\/([^/]+)\/.+$/.exec(
    window.location.pathname
  );
  if (unknownProjectRoute?.[1]) {
    return {
      screen: 'movieStudio',
      projectName: decodeURIComponent(unknownProjectRoute[1]),
      selection: { type: 'projectInformation' },
      routeError: `Unknown project route: ${window.location.pathname}`,
    };
  }

  return { screen: 'projectLibrary' };
}

function validateRouteSelection(
  project: ProjectWithHttp,
  route: Extract<StudioRoute, { screen: 'movieStudio' }>
): void {
  if (route.routeError) {
    throw new Error(route.routeError);
  }

  const selection = route.selection;
  if (
    selection.type === 'cast' &&
    !project.cast.some((castEntry) => castEntry.id === selection.id)
  ) {
    throw new Error(`Cast member not found: ${selection.id}`);
  }
  if (
    selection.type === 'sequence' &&
    !project.sequences.some((sequence) => sequence.id === selection.id)
  ) {
    throw new Error(`Sequence not found: ${selection.id}`);
  }
  if (
    selection.type === 'scene' &&
    !project.sequences.some((sequence) =>
      sequence.scenes.some((scene) => scene.id === selection.id)
    )
  ) {
    throw new Error(`Scene not found: ${selection.id}`);
  }
  if (
    selection.type === 'clip' &&
    !project.sequences.some((sequence) =>
      sequence.scenes.some((scene) =>
        scene.clips.some((clip) => clip.id === selection.id)
      )
    )
  ) {
    throw new Error(`Clip not found: ${selection.id}`);
  }
}

function projectRoutePath(projectName: string): string {
  return `/projects/${encodeURIComponent(projectName)}`;
}

function movieStudioSelectionRoutePath(
  projectName: string,
  selection: MovieStudioSelection
): string {
  if (selection.type === 'casting') {
    return `${projectRoutePath(projectName)}/cast`;
  }
  if (selection.type === 'cast') {
    return `${projectRoutePath(projectName)}/cast/${encodeURIComponent(selection.id)}`;
  }
  if (selection.type === 'visualLanguage') {
    return `${projectRoutePath(projectName)}/visual-language`;
  }
  if (selection.type === 'storyboard') {
    return `${projectRoutePath(projectName)}/storyboard`;
  }
  if (selection.type === 'sequence') {
    return `${projectRoutePath(projectName)}/sequences/${encodeURIComponent(selection.id)}`;
  }
  if (selection.type === 'scene') {
    return `${projectRoutePath(projectName)}/scenes/${encodeURIComponent(selection.id)}`;
  }
  if (selection.type === 'clip') {
    return `${projectRoutePath(projectName)}/clips/${encodeURIComponent(selection.id)}`;
  }
  return projectRoutePath(projectName);
}

function movieStudioSelectionKey(selection: MovieStudioSelection): string {
  return JSON.stringify(selection);
}

function pushRoutePath(path: string): void {
  if (window.location.pathname === path) {
    return;
  }
  window.history.pushState({}, '', path);
}
