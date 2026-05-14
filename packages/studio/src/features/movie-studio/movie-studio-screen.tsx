import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { DebouncedAutosaveStatus } from '@/hooks/use-debounced-autosave';
import { exportProductionAssets } from '@/services/studio-projects-api';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { AutosaveStatus } from '@/ui/autosave-status';
import { CastDesignPanel } from './cast-design/cast-design-panel';
import { CastOverviewPanel } from './cast-design/cast-overview-panel';
import { ClipDesignPanel } from './clip-design/clip-design-panel';
import { GenerationActivityFooter } from './generation-activity/generation-activity-footer';
import { ProjectInformationPanel } from './project-information/project-information-panel';
import { StoryboardPanel } from './storyboard/storyboard-panel';
import { StudioSidebar } from './studio-sidebar/studio-sidebar';
import { useStoryNavigation } from './use-story-navigation';
import { useStudioSelectionResolution } from './use-movie-studio-selection-resolution';
import type { StudioSelection } from './movie-studio-selection';
import { VisualLanguagePanel } from './visual-language/visual-language-panel';

interface MovieStudioScreenProps {
  project: ProjectShellWithHttp;
  onHome: () => void;
  onProjectChange: (project: ProjectShellWithHttp) => void;
  onNavigateSelection: (
    selection: StudioSelection
  ) => Promise<{ routeChanged: boolean }>;
  selection: StudioSelection | null;
}

export function MovieStudioScreen({
  project,
  onHome,
  onProjectChange,
  onNavigateSelection,
  selection: routeSelection,
}: MovieStudioScreenProps) {
  const storyNavigation = useStoryNavigation(
    project,
    routeSelection ?? { type: 'projectInformation' }
  );
  const studioSelection = useStudioSelectionResolution(
    project,
    routeSelection,
    storyNavigation
  );
  const { selection, resolvedSelection } = studioSelection;
  const [projectInformationAutosave, setProjectInformationAutosave] =
    useState<DebouncedAutosaveStatus>({ state: 'idle', message: null });
  const [isProductionExportRunning, setIsProductionExportRunning] = useState(false);
  const handleProjectInformationAutosaveStatusChange = useCallback(
    (status: DebouncedAutosaveStatus) => {
      setProjectInformationAutosave(status);
    },
    []
  );
  const selectMovieStudioSurface = useCallback(
    (nextSelection: StudioSelection) => {
      void onNavigateSelection(nextSelection);
    },
    [onNavigateSelection]
  );
  const handleProductionExport = useCallback(async () => {
    setIsProductionExportRunning(true);
    toast.loading('Exporting production assets', {
      id: 'production-export',
    });
    try {
      const summary = await exportProductionAssets(project.identity.name);
      toast.success('Production assets exported', {
        id: 'production-export',
        description: `Copied ${summary.copiedFileCount}, skipped ${summary.skippedFileCount}, pruned ${summary.prunedFileCount}.`,
      });
    } catch (error) {
      toast.error('Export failed', {
        id: 'production-export',
        description:
          error instanceof Error
            ? error.message
            : 'Production export failed.',
      });
    } finally {
      setIsProductionExportRunning(false);
    }
  }, [project.identity.name]);

  return (
    <div className='h-screen w-screen bg-background text-foreground p-3 flex flex-col gap-3'>
      <main className='flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)] gap-3'>
        <StudioSidebar
          project={project}
          storyNavigation={storyNavigation}
          selection={selection}
          onSelect={selectMovieStudioSurface}
          onHome={onHome}
          isProductionExportRunning={isProductionExportRunning}
          onProductionExport={handleProductionExport}
        />
        {selection.type === 'cast' && resolvedSelection.castEntry ? (
          <CastDesignPanel
            key={resolvedSelection.castEntry.id}
            projectName={project.identity.name}
            castEntry={resolvedSelection.castEntry}
            onProjectChange={onProjectChange}
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
                {selection.type === 'projectInformation' ? (
                  <AutosaveStatus
                    status={projectInformationAutosave}
                    className='shrink-0'
                  />
                ) : null}
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
