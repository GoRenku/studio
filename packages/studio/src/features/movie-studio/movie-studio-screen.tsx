import { useCallback, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import type { DebouncedAutosaveStatus } from '@/hooks/use-debounced-autosave';
import { exportProductionAssets } from '@/services/studio-projects-api';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import { AutosaveStatus } from '@/ui/autosave-status';
import { Button } from '@/ui/button';
import { CastDesignPanel } from './cast-design/cast-design-panel';
import { CastOverviewPanel } from './cast-design/cast-overview-panel';
import { ClipDesignPanel } from './clip-design/clip-design-panel';
import { GenerationActivityFooter } from './generation-activity/generation-activity-footer';
import { ProjectInformationPanel } from './project-information/project-information-panel';
import { StoryboardPanel } from './storyboard/storyboard-panel';
import { StudioSidebar } from './studio-sidebar/studio-sidebar';
import { useMovieStudioSelection } from './use-movie-studio-selection';
import type { MovieStudioSelection } from './movie-studio-selection';
import { VisualLanguagePanel } from './visual-language/visual-language-panel';

interface MovieStudioScreenProps {
  project: ProjectWithHttp;
  onHome: () => void;
  onProjectChange: (project: ProjectWithHttp) => void;
  onNavigateSelection: (selection: MovieStudioSelection) => Promise<void>;
  selection: ReturnType<typeof useMovieStudioSelection>;
}

export function MovieStudioScreen({
  project,
  onHome,
  onProjectChange,
  onNavigateSelection,
  selection: movieStudioSelection,
}: MovieStudioScreenProps) {
  const { selection, setSelection, resolvedSelection } = movieStudioSelection;
  const [projectInformationAutosave, setProjectInformationAutosave] =
    useState<DebouncedAutosaveStatus>({ state: 'idle', message: null });
  const [productionExportStatus, setProductionExportStatus] = useState<
    | { state: 'idle'; message: null }
    | { state: 'running'; message: string }
    | { state: 'complete'; message: string }
    | { state: 'error'; message: string }
  >({ state: 'idle', message: null });
  const handleProjectInformationAutosaveStatusChange = useCallback(
    (status: DebouncedAutosaveStatus) => {
      setProjectInformationAutosave(status);
    },
    []
  );
  const selectMovieStudioSurface = useCallback(
    (nextSelection: MovieStudioSelection) => {
      setSelection(nextSelection);
      void onNavigateSelection(nextSelection);
    },
    [onNavigateSelection, setSelection]
  );
  const handleProductionExport = useCallback(async () => {
    setProductionExportStatus({
      state: 'running',
      message: 'Exporting production assets...',
    });
    try {
      const summary = await exportProductionAssets(project.identity.name);
      setProductionExportStatus({
        state: 'complete',
        message: `Copied ${summary.copiedFileCount}, skipped ${summary.skippedFileCount}, pruned ${summary.prunedFileCount}.`,
      });
    } catch (error) {
      setProductionExportStatus({
        state: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Production export failed.',
      });
    }
  }, [project.identity.name]);

  return (
    <div className='h-screen w-screen bg-background text-foreground p-3 flex flex-col gap-3'>
      <main className='flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)] gap-3'>
        <StudioSidebar
          project={project}
          selection={selection}
          onSelect={selectMovieStudioSurface}
          onHome={onHome}
        />
        {selection.type === 'cast' && resolvedSelection.castEntry ? (
          <CastDesignPanel
            key={resolvedSelection.castEntry.id}
            projectName={project.identity.name}
            castEntry={resolvedSelection.castEntry}
            initialAssets={
              project.castAssetsByCastMemberId
                ? (project.castAssetsByCastMemberId[
                    resolvedSelection.castEntry.id
                  ] ?? [])
                : undefined
            }
          />
        ) : (
          <section className='min-h-0 rounded-(--radius-panel) border border-panel-border bg-panel-bg overflow-hidden flex flex-col'>
            <div className='h-[45px] px-4 border-b border-border/40 bg-panel-header-bg flex items-center justify-between shrink-0'>
              <div className='min-w-0'>
                <h2 className='truncate text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
                  {resolvedSelection.kicker}
                </h2>
              </div>
              <div className='flex min-w-0 items-center gap-3'>
                {productionExportStatus.message ? (
                  <p
                    className={
                      productionExportStatus.state === 'error'
                        ? 'hidden md:block truncate text-xs font-medium text-destructive'
                        : 'hidden md:block truncate text-xs font-medium text-muted-foreground'
                    }
                  >
                    {productionExportStatus.message}
                  </p>
                ) : null}
                {selection.type === 'projectInformation' ? (
                  <AutosaveStatus
                    status={projectInformationAutosave}
                    className='shrink-0'
                  />
                ) : null}
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => void handleProductionExport()}
                  disabled={productionExportStatus.state === 'running'}
                  className='shrink-0 gap-2'
                >
                  {productionExportStatus.state === 'running' ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <Upload className='h-3.5 w-3.5' />
                  )}
                  Export
                </Button>
              </div>
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
                <ClipDesignPanel
                  projectName={project.identity.name}
                  clip={resolvedSelection.clip}
                  onProjectChange={onProjectChange}
                />
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
