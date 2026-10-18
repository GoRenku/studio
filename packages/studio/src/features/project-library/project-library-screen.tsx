import { useState } from 'react';
import { FolderOpen, Loader2, Search } from 'lucide-react';
import { StudioAppHeader } from '@/app/studio-app-header';
import type { StudioUpdateController } from '@/app/use-studio-update';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import type { ProjectLibraryWithHttp } from '@/services/studio-project-contracts';
import { deleteProject } from '@/services/studio-projects-api';
import { CreateProjectDialog } from './create-project-dialog';
import { NoMatchingProjects } from './no-matching-projects';
import { ProjectLibraryCard } from './project-library-card';
import { ProjectLibraryStarts } from './project-library-starts';
import { SampleFilmTileStart } from './sample-film-start';
import { useProjectLibrarySearch } from './use-project-library-search';
import { useSampleFilmInstallation } from './use-sample-film-installation';

interface ProjectLibraryScreenProps {
  update: StudioUpdateController;
  error: string | null;
  library: ProjectLibraryWithHttp | null;
  isLoadingLibrary: boolean;
  isSelectingProject: boolean;
  onRefresh: () => Promise<void>;
  onSelectProject: (projectName: string) => Promise<void>;
}

export function ProjectLibraryScreen({
  update,
  error,
  library,
  isLoadingLibrary,
  isSelectingProject,
  onRefresh,
  onSelectProject,
}: ProjectLibraryScreenProps) {
  const [query, setQuery] = useState('');
  const filteredProjects = useProjectLibrarySearch(library?.projects ?? [], query);
  const sampleFilm = useSampleFilmInstallation({
    libraryVersion: library,
    onReady: async (projectName) => {
      await onRefresh();
      await onSelectProject(projectName);
    },
  });
  const hasQuery = query.trim() !== '';
  const handleDeleteProject = async (
    projectName: string,
    confirmationProjectName: string
  ) => {
    await deleteProject(projectName, confirmationProjectName);
    await onRefresh();
  };

  return (
    <div className='h-screen w-screen bg-background text-foreground p-4 flex flex-col gap-4'>
      <StudioAppHeader update={update} />

      <main className='flex-1 min-h-0 rounded-(--radius-panel) border border-sidebar-border bg-sidebar-bg overflow-hidden flex flex-col'>
        <div className='h-[52px] px-4 border-b border-border/40 bg-sidebar-header-bg flex items-center justify-between gap-4 shrink-0'>
          <div className='min-w-0 flex items-center gap-2'>
            <FolderOpen className='w-4 h-4 shrink-0 text-muted-foreground' />
            <div className='min-w-0'>
              <h1 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
                Project Library
              </h1>
              <p className='truncate text-xs text-muted-foreground'>
                {library?.storageRoot ?? 'Loading Renku Studio storage root...'}
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <div className='relative hidden sm:block w-[280px]'>
              <Search className='pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Search projects'
                className='h-8 pl-8'
              />
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={isLoadingLibrary}
              onClick={() => void onRefresh()}
            >
              {isLoadingLibrary ? (
                <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
              ) : (
                <FolderOpen className='mr-2 h-3.5 w-3.5' />
              )}
              Refresh
            </Button>
            {library ? (
              <CreateProjectDialog
                storageRoot={library.storageRoot}
                onCreated={onSelectProject}
              />
            ) : null}
          </div>
        </div>

        <div className='sm:hidden border-b border-border/40 p-3'>
          <div className='relative'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search projects'
              className='h-8 pl-8'
            />
          </div>
        </div>

        {error ? (
          <div className='mx-4 mt-4 rounded-lg border border-red-500/45 bg-red-500/14 px-3 py-2 text-xs leading-relaxed text-red-700 dark:text-red-300'>
            {error}
          </div>
        ) : null}

        <div className='flex-1 min-h-0 overflow-y-auto p-4'>
          {isLoadingLibrary && !library ? (
            <div className='h-full min-h-[280px] flex items-center justify-center'>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading projects...
              </div>
            </div>
          ) : library && library.projects.length === 0 ? (
            <div className='h-full flex'>
              <ProjectLibraryStarts
                storageRoot={library.storageRoot}
                sampleFilm={sampleFilm}
                onCreated={onSelectProject}
              />
            </div>
          ) : filteredProjects.length === 0 ? (
            <NoMatchingProjects />
          ) : (
            <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
              {filteredProjects.map((project) => (
                <ProjectLibraryCard
                  key={project.projectName}
                  project={project}
                  isSelectingProject={isSelectingProject}
                  onSelectProject={onSelectProject}
                  onDeleteProject={handleDeleteProject}
                />
              ))}
              {!hasQuery && sampleFilm.inLibrary === false ? (
                <SampleFilmTileStart controller={sampleFilm} />
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
