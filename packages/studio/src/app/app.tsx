import { Loader2 } from 'lucide-react';
import { ProjectLibraryScreen } from '@/features/project-library/project-library-screen';
import { MovieStudioScreen } from '@/features/movie-studio/movie-studio-screen';
import { useProjectSession } from '@/app/use-project-session';
import { useStudioCoordination } from '@/app/use-studio-coordination';
import { useMovieStudioSelection } from '@/features/movie-studio/use-movie-studio-selection';

function App() {
  const projectSession = useProjectSession();
  const movieStudioSelection = useMovieStudioSelection(projectSession.project);

  useStudioCoordination({
    projectSession,
    movieStudioSelection: {
      selection: movieStudioSelection.selection,
      setSelection: movieStudioSelection.setSelection,
    },
  });

  if (projectSession.isLoadingCurrentProject) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background text-foreground px-6'>
        <div className='max-w-xl w-full rounded-2xl border border-border/50 bg-card/60 p-8 shadow-lg flex flex-col gap-4 items-center'>
          <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>Loading Renku Studio...</p>
        </div>
      </div>
    );
  }

  if (projectSession.project) {
    return (
      <MovieStudioScreen
        project={projectSession.project}
        onHome={projectSession.returnToProjectLibrary}
        onProjectChange={projectSession.updateCurrentProject}
        selection={movieStudioSelection}
      />
    );
  }

  return (
    <ProjectLibraryScreen
      error={projectSession.projectSessionError}
      library={projectSession.library}
      isLoadingLibrary={projectSession.isLoadingProjectLibrary}
      isSelectingProject={projectSession.isSelectingProject}
      onRefresh={projectSession.refreshProjectLibrary}
      onSelectProject={async (projectName) => {
        await projectSession.selectProject(projectName);
      }}
    />
  );
}

export default App;
