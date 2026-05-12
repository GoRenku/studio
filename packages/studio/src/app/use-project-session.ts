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
      selection?: MovieStudioSelection;
    };

export interface ProjectSession {
  project: ProjectWithHttp | null;
  library: ProjectLibraryWithHttp | null;
  isLoadingProjectRoute: boolean;
  isLoadingProjectLibrary: boolean;
  isSelectingProject: boolean;
  projectSessionError: string | null;
  routeSelection: MovieStudioSelection | null;
  refreshProjectLibrary: () => Promise<void>;
  refreshProject: (projectName: string) => Promise<ProjectWithHttp>;
  navigateToProject: (projectName: string) => Promise<ProjectWithHttp | null>;
  navigateToMovieStudioSelection: (
    selection: MovieStudioSelection
  ) => Promise<void>;
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
            validateRouteSelection(currentProject, route.selection);
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
        validateRouteSelection(nextProject, route.selection);
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
      setRoute({ screen: 'movieStudio', projectName });
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

  const navigateToMovieStudioSelection = useCallback(
    async (selection: MovieStudioSelection) => {
      const projectName =
        project?.identity.name ??
        (route.screen === 'movieStudio' ? route.projectName : null);
      if (!projectName) {
        return;
      }
      const path = movieStudioSelectionRoutePath(projectName, selection);
      const routeSelection = routableMovieStudioSelection(selection);
      if (
        window.location.pathname === path &&
        route.screen === 'movieStudio' &&
        route.projectName === projectName &&
        movieStudioSelectionKey(route.selection) ===
          movieStudioSelectionKey(routeSelection)
      ) {
        return;
      }
      pushRoutePath(path);
      setRoute({
        screen: 'movieStudio',
        projectName,
        selection: routeSelection,
      });
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
    routeSelection:
      route.screen === 'movieStudio' ? route.selection ?? null : null,
    refreshProjectLibrary,
    refreshProject,
    navigateToProject,
    navigateToMovieStudioSelection,
    updateCurrentProject,
    returnToProjectLibrary,
  };
}

function readStudioRoute(): StudioRoute {
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

  const projectRoute = /^\/projects\/([^/]+)\/?$/.exec(window.location.pathname);
  if (!projectRoute?.[1]) {
    return { screen: 'projectLibrary' };
  }

  return {
    screen: 'movieStudio',
    projectName: decodeURIComponent(projectRoute[1]),
  };
}

function validateRouteSelection(
  project: ProjectWithHttp,
  selection?: MovieStudioSelection
): void {
  if (
    selection?.type === 'cast' &&
    !project.cast.some((castEntry) => castEntry.id === selection.id)
  ) {
    throw new Error(`Cast member not found: ${selection.id}`);
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
  return projectRoutePath(projectName);
}

function routableMovieStudioSelection(
  selection: MovieStudioSelection
): MovieStudioSelection | undefined {
  return selection.type === 'casting' || selection.type === 'cast'
    ? selection
    : undefined;
}

function movieStudioSelectionKey(selection?: MovieStudioSelection): string {
  return selection ? JSON.stringify(selection) : '';
}

function pushRoutePath(path: string): void {
  if (window.location.pathname === path) {
    return;
  }
  window.history.pushState({}, '', path);
}
