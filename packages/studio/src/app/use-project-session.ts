import { useCallback, useEffect, useState } from 'react';
import {
  readCurrentProject,
  readProject,
  readProjectLibrary,
  selectProject as selectStudioProject,
} from '@/services/studio-projects-api';
import type {
  ProjectLibraryWithHttp,
  ProjectWithHttp,
} from '@/services/studio-project-contracts';

export interface ProjectSession {
  project: ProjectWithHttp | null;
  library: ProjectLibraryWithHttp | null;
  isLoadingCurrentProject: boolean;
  isLoadingProjectLibrary: boolean;
  isSelectingProject: boolean;
  projectSessionError: string | null;
  refreshProjectLibrary: () => Promise<void>;
  refreshCurrentProject: () => Promise<ProjectWithHttp | null>;
  refreshProject: (projectName: string) => Promise<ProjectWithHttp>;
  selectProject: (projectName: string) => Promise<ProjectWithHttp | null>;
  updateCurrentProject: (project: ProjectWithHttp) => void;
  returnToProjectLibrary: () => void;
}

export function useProjectSession(): ProjectSession {
  const [project, setProject] = useState<ProjectWithHttp | null>(null);
  const [library, setLibrary] = useState<ProjectLibraryWithHttp | null>(null);
  const [isLoadingCurrentProject, setIsLoadingCurrentProject] = useState(true);
  const [isLoadingProjectLibrary, setIsLoadingProjectLibrary] = useState(false);
  const [isSelectingProject, setIsSelectingProject] = useState(false);
  const [projectSessionError, setProjectSessionError] = useState<string | null>(
    null
  );

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

  const refreshCurrentProject = useCallback(async () => {
    const currentProject = await readCurrentProject();
    setProject(currentProject);
    if (!currentProject) {
      await refreshProjectLibrary();
    }
    return currentProject;
  }, [refreshProjectLibrary]);

  const refreshProject = useCallback(async (projectName: string) => {
    const nextProject = await readProject(projectName);
    setProject(nextProject);
    return nextProject;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentProject() {
      try {
        await refreshCurrentProject();
        if (cancelled) {
          return;
        }
      } catch {
        if (!cancelled) {
          setProject(null);
          await refreshProjectLibrary();
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCurrentProject(false);
        }
      }
    }

    void loadCurrentProject();

    return () => {
      cancelled = true;
    };
  }, [refreshCurrentProject, refreshProjectLibrary]);

  const selectProject = useCallback(async (projectName: string) => {
    setIsSelectingProject(true);
    setProjectSessionError(null);
    try {
      const nextProject = await selectStudioProject(projectName);
      setProject(nextProject);
      window.history.pushState({}, '', '/project');
      return nextProject;
    } catch (selectionError) {
      setProjectSessionError(
        selectionError instanceof Error
          ? selectionError.message
          : 'Unable to select project.'
      );
      return null;
    } finally {
      setIsSelectingProject(false);
    }
  }, []);

  const returnToProjectLibrary = useCallback(() => {
    setProject(null);
    setProjectSessionError(null);
    window.history.pushState({}, '', '/');
    void refreshProjectLibrary();
  }, [refreshProjectLibrary]);

  const updateCurrentProject = useCallback((nextProject: ProjectWithHttp) => {
    setProject(nextProject);
  }, []);

  return {
    project,
    library,
    isLoadingCurrentProject,
    isLoadingProjectLibrary,
    isSelectingProject,
    projectSessionError,
    refreshProjectLibrary,
    refreshCurrentProject,
    refreshProject,
    selectProject,
    updateCurrentProject,
    returnToProjectLibrary,
  };
}
