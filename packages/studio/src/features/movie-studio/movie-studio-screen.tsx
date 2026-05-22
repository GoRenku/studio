import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { DebouncedAutosaveStatus } from '@/hooks/use-debounced-autosave';
import { exportProductionAssets } from '@/services/studio-projects-api';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { AutosaveStatus } from '@/ui/autosave-status';
import { CastOverviewPanel } from './cast/cast-overview-panel';
import { CastMemberPanel } from './cast/cast-member-panel';
import { GenerationActivityFooter } from './generation-activity/generation-activity-footer';
import { LocationOverviewPanel } from './locations/location-overview-panel';
import { LocationPanel } from './locations/location-panel';
import { PanelShell } from './panel-shell';
import { ProjectInformationPanel } from './project-information/project-information-panel';
import { ScenePanel } from './scenes/scene-panel';
import { SequencePanel } from './sequences/sequence-panel';
import { StoryArcPanel } from './story-arc/story-arc-panel';
import { StudioSidebar } from './studio-sidebar/studio-sidebar';
import { useScreenplayNavigation } from './use-screenplay-navigation';
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
  const screenplayNavigation = useScreenplayNavigation(
    project,
    routeSelection ?? { type: 'projectInformation' }
  );
  const studioSelection = useStudioSelectionResolution(
    project,
    routeSelection,
    screenplayNavigation
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
          screenplayNavigation={screenplayNavigation}
          selection={selection}
          onSelect={selectMovieStudioSurface}
          onHome={onHome}
          isProductionExportRunning={isProductionExportRunning}
          onProductionExport={handleProductionExport}
        />
        <PanelShell
          title={resolvedSelection.kicker}
          action={
            selection.type === 'projectInformation' ? (
              <AutosaveStatus
                status={projectInformationAutosave}
                className='shrink-0'
              />
            ) : null
          }
        >
          {selection.type === 'projectInformation' ? (
            <ProjectInformationPanel
              project={project}
              onProjectChange={onProjectChange}
              onAutosaveStatusChange={handleProjectInformationAutosaveStatusChange}
            />
          ) : selection.type === 'visualLanguage' ? (
            <VisualLanguagePanel project={project} />
          ) : selection.type === 'cast' ? (
            <CastOverviewPanel
              projectName={project.identity.name}
              onSelect={selectMovieStudioSurface}
            />
          ) : selection.type === 'castMember' ? (
            <CastMemberPanel
              key={selection.id}
              projectName={project.identity.name}
              castMemberId={selection.id}
            />
          ) : selection.type === 'locations' ? (
            <LocationOverviewPanel
              projectName={project.identity.name}
              onSelect={selectMovieStudioSurface}
            />
          ) : selection.type === 'location' ? (
            <LocationPanel
              key={selection.id}
              projectName={project.identity.name}
              locationId={selection.id}
            />
          ) : selection.type === 'storyArc' ? (
            <StoryArcPanel projectName={project.identity.name} />
          ) : selection.type === 'sequence' ? (
            <SequencePanel
              key={selection.id}
              projectName={project.identity.name}
              sequenceId={selection.id}
              onSelect={selectMovieStudioSurface}
            />
          ) : (
            <ScenePanel
              key={selection.id}
              projectName={project.identity.name}
              sceneId={selection.id}
              onSelect={selectMovieStudioSurface}
            />
          )}
        </PanelShell>
      </main>

      <GenerationActivityFooter project={project} />
    </div>
  );
}
