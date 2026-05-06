import { useCallback, useState } from 'react';
import { StudioAppHeader } from '@/app/studio-app-header';
import type { DebouncedAutosaveStatus } from '@/hooks/use-debounced-autosave';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import { AutosaveStatus } from '@/ui/autosave-status';
import { CastDesignPanel } from './cast-design/cast-design-panel';
import { CastOverviewPanel } from './cast-design/cast-overview-panel';
import { ClipDesignPanel } from './clip-design/clip-design-panel';
import { GenerationActivityFooter } from './generation-activity/generation-activity-footer';
import { ProjectInformationPanel } from './project-information/project-information-panel';
import { StoryboardPanel } from './storyboard/storyboard-panel';
import { StudioSidebar } from './studio-sidebar/studio-sidebar';
import { useMovieStudioSelection } from './use-movie-studio-selection';
import { VisualLanguagePanel } from './visual-language/visual-language-panel';

interface MovieStudioScreenProps {
  project: ProjectWithHttp;
  onHome: () => void;
  onProjectChange: (project: ProjectWithHttp) => void;
}

export function MovieStudioScreen({
  project,
  onHome,
  onProjectChange,
}: MovieStudioScreenProps) {
  const { selection, setSelection, resolvedSelection } =
    useMovieStudioSelection(project);
  const [projectInformationAutosave, setProjectInformationAutosave] =
    useState<DebouncedAutosaveStatus>({ state: 'idle', message: null });
  const handleProjectInformationAutosaveStatusChange = useCallback(
    (status: DebouncedAutosaveStatus) => {
      setProjectInformationAutosave(status);
    },
    []
  );

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
                {resolvedSelection.title ? (
                  <p className='truncate text-sm font-semibold'>
                    {resolvedSelection.title}
                  </p>
                ) : null}
              </div>
              {selection.type === 'projectInformation' ? (
                <AutosaveStatus
                  status={projectInformationAutosave}
                  className='shrink-0'
                />
              ) : null}
            </div>

            <div className='flex-1 min-h-0 overflow-y-auto p-4'>
              {selection.type === 'projectInformation' ? (
                <ProjectInformationPanel
                  project={project}
                  onProjectChange={onProjectChange}
                  onAutosaveStatusChange={
                    handleProjectInformationAutosaveStatusChange
                  }
                />
              ) : selection.type === 'visualLanguage' ? (
                <VisualLanguagePanel project={project} />
              ) : selection.type === 'clip' && resolvedSelection.clip ? (
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
