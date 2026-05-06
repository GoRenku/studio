import { StudioAppHeader } from '@/app/studio-app-header';
import { CastDesignPanel } from './cast-design/cast-design-panel';
import { CastOverviewPanel } from './cast-design/cast-overview-panel';
import { ClipDesignPanel } from './clip-design/clip-design-panel';
import { GenerationActivityFooter } from './generation-activity/generation-activity-footer';
import { StoryboardPanel } from './storyboard/storyboard-panel';
import { StudioSidebar } from './studio-sidebar/studio-sidebar';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import { useMovieStudioSelection } from './use-movie-studio-selection';

interface MovieStudioScreenProps {
  project: ProjectWithHttp;
  onHome: () => void;
}

export function MovieStudioScreen({ project, onHome }: MovieStudioScreenProps) {
  const { selection, setSelection, resolvedSelection } =
    useMovieStudioSelection(project);

  return (
    <div className='h-screen w-screen bg-background text-foreground p-3 flex flex-col gap-3'>
      <StudioAppHeader
        subtitle='Studio'
        projectTitle={project.identity.title}
        onHome={onHome}
      />

      <main className='flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)] gap-3'>
        <StudioSidebar
          project={project}
          selection={selection}
          onSelect={setSelection}
        />
        {selection.type === 'cast' && resolvedSelection.castEntry ? (
          <CastDesignPanel castEntry={resolvedSelection.castEntry} />
        ) : (
          <section className='min-h-0 rounded-(--radius-panel) border border-panel-border bg-panel-bg overflow-hidden flex flex-col'>
            <div className='h-[45px] px-4 border-b border-border/40 bg-panel-header-bg flex items-center justify-between shrink-0'>
              <div className='min-w-0'>
                <h2 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
                  {resolvedSelection.kicker}
                </h2>
                <p className='truncate text-sm font-semibold'>
                  {resolvedSelection.title}
                </p>
              </div>
              <span className='rounded-full border border-amber-500/45 bg-amber-500/14 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300'>
                Scaffold
              </span>
            </div>

            <div className='flex-1 min-h-0 overflow-y-auto p-4'>
              {selection.type === 'clip' && resolvedSelection.clip ? (
                <ClipDesignPanel clip={resolvedSelection.clip} />
              ) : selection.type === 'casting' ? (
                <CastOverviewPanel cast={project.cast} />
              ) : (
                <StoryboardPanel selected={resolvedSelection} />
              )}
            </div>
          </section>
        )}
      </main>

      <GenerationActivityFooter project={project} />
    </div>
  );
}
