import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ProjectOpener } from '@/components/project-opener';
import { MovieWorkspace } from '@/components/movie-workspace';
import {
  fetchCurrentProject,
  fetchProjectLibrary,
  openProject,
} from '@/data/movie-studio-client';
import type {
  ProjectLibraryWithHttp,
  ProjectWithHttp,
} from '@/types/movie-project';

function App() {
  const [project, setProject] = useState<ProjectWithHttp | null>(null);
  const [library, setLibrary] = useState<ProjectLibraryWithHttp | null>(null);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    setError(null);
    try {
      setLibrary(await fetchProjectLibrary());
    } catch (libraryError) {
      setError(
        libraryError instanceof Error
          ? libraryError.message
          : 'Unable to load project library.'
      );
    } finally {
      setIsLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentProject() {
      try {
        const currentProject = await fetchCurrentProject();
        if (cancelled) {
          return;
        }
        setProject(currentProject);
        if (!currentProject) {
          await refreshLibrary();
        }
      } catch {
        if (!cancelled) {
          setProject(null);
          await refreshLibrary();
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCurrent(false);
        }
      }
    }

    void loadCurrentProject();

    return () => {
      cancelled = true;
    };
  }, [refreshLibrary]);

  const handleOpenProject = useCallback(async (projectName: string) => {
    setIsOpening(true);
    setError(null);
    try {
      const nextProject = await openProject(projectName);
      setProject(nextProject);
      window.history.pushState({}, '', '/project');
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : 'Unable to open project.'
      );
    } finally {
      setIsOpening(false);
    }
  }, []);

  const handleHome = useCallback(() => {
    setProject(null);
    setError(null);
    window.history.pushState({}, '', '/');
    void refreshLibrary();
  }, [refreshLibrary]);

  if (isLoadingCurrent) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background text-foreground px-6'>
        <div className='max-w-xl w-full rounded-2xl border border-border/50 bg-card/60 p-8 shadow-lg flex flex-col gap-4 items-center'>
          <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>Loading Renku Studio...</p>
        </div>
      </div>
    );
  }

  if (project) {
    return <MovieWorkspace project={project} onHome={handleHome} />;
  }

  return (
    <ProjectOpener
      error={error}
      library={library}
      isLoadingLibrary={isLoadingLibrary}
      isOpening={isOpening}
      onRefresh={refreshLibrary}
      onOpen={handleOpenProject}
    />
  );
}

export default App;
