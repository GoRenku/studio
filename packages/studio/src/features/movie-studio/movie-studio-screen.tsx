import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { DebouncedSaveStatus } from '@/hooks/use-debounced-autosave';
import { exportProductionAssets } from '@/services/studio-projects-api';
import { createInspirationFolder } from '@/services/studio-visual-language-api';
import {
  matchesVisualLanguageInspirationResource,
  matchesVisualLanguageLookbooksResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/ui/resizable';
import { CastOverviewPanel } from './cast/cast-overview-panel';
import { CastMemberPanel } from './cast/cast-member-panel';
import { GenerationActivityFooter } from './generation-activity/generation-activity-footer';
import { LocationOverviewPanel } from './locations/location-overview-panel';
import { LocationPanel } from './locations/location-panel';
import { MOVIE_STUDIO_LAYOUT } from './movie-studio-layout';
import { PanelShell } from './panel-shell';
import { ProjectInformationPanel } from './project-information/project-information-panel';
import { ActStoryboardPanel } from './acts/act-storyboard-panel';
import { ScenePanel } from './scenes/scene-panel';
import { SequencePanel } from './sequences/sequence-panel';
import { StoryArcPanel } from './story-arc/story-arc-panel';
import { StudioSidebar } from './studio-sidebar/studio-sidebar';
import { useScreenplayNavigation } from './use-screenplay-navigation';
import { useStudioSelectionResolution } from './use-movie-studio-selection-resolution';
import type { StudioSelection } from './movie-studio-selection';
import { InspirationFolderCreateDialog } from './visual-language/inspiration-folder-create-dialog';
import { VisualLanguagePanel } from './visual-language/visual-language-panel';
import {
  idleSaveNotification,
  saveNotificationStatusesEqual,
} from './detail-save-notification';

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
    useState<DebouncedSaveStatus>({ state: 'idle', message: null });
  const [isProductionExportRunning, setIsProductionExportRunning] = useState(false);
  const [lookbooksRevision, setLookbooksRevision] = useState(0);
  const [inspirationFoldersRevision, setInspirationFoldersRevision] = useState(0);
  const [sceneHeaderAction, setSceneHeaderAction] = useState<{
    sceneId: string;
    action: ReactNode | null;
  } | null>(null);
  const [sceneHeaderTitle, setSceneHeaderTitle] = useState<{
    sceneId: string;
    title: string | null;
  } | null>(null);
  const [sceneSaveNotification, setSceneSaveNotification] = useState<{
    sceneId: string;
    status: SaveNotificationStatus;
  } | null>(null);
  const handleProjectInformationSaveStatusChange = useCallback(
    (status: DebouncedSaveStatus) => {
      setProjectInformationAutosave(status);
    },
    []
  );
  const handleLookbooksChange = useCallback(() => {
    setLookbooksRevision((current) => current + 1);
  }, []);
  const handleInspirationFoldersChange = useCallback(() => {
    setInspirationFoldersRevision((current) => current + 1);
  }, []);

  useStudioResourceRefresh({
    projectName: project.identity.name,
    matches: matchesVisualLanguageLookbooksResource,
    onRefresh: handleLookbooksChange,
  });
  useStudioResourceRefresh({
    projectName: project.identity.name,
    matches: (resourceKeys) =>
      matchesVisualLanguageInspirationResource(resourceKeys),
    onRefresh: handleInspirationFoldersChange,
  });
  const selectMovieStudioSurface = useCallback(
    (nextSelection: StudioSelection) => {
      void onNavigateSelection(nextSelection);
    },
    [onNavigateSelection]
  );

  const sceneNeighbors = useMemo<{
    previousScene: { id: string; title: string } | null;
    nextScene: { id: string; title: string } | null;
  }>(() => {
    if (selection.type !== 'scene') {
      return { previousScene: null, nextScene: null };
    }
    const context = screenplayNavigation.selectionContext;
    if (!context || !('sequence' in context)) {
      return { previousScene: null, nextScene: null };
    }
    const sequenceId = context.sequence.id;
    const actId = context.act.id;
    const scenes = screenplayNavigation.scenesBySequenceId.get(sequenceId) ?? [];
    const sceneIndex = scenes.findIndex((scene) => scene.id === selection.id);
    if (sceneIndex === -1) {
      return { previousScene: null, nextScene: null };
    }
    const sequencesInAct =
      screenplayNavigation.sequencesByActId.get(actId) ?? [];
    const sequenceIndex = sequencesInAct.findIndex((seq) => seq.id === sequenceId);

    const adjacentSequenceScene = (
      offset: -1 | 1
    ): { id: string; title: string } | null => {
      if (sequenceIndex === -1) return null;
      const target = sequencesInAct[sequenceIndex + offset];
      if (!target) return null;
      const targetScenes =
        screenplayNavigation.scenesBySequenceId.get(target.id) ?? [];
      if (!targetScenes.length) return null;
      const scene =
        offset === 1
          ? targetScenes[0]
          : targetScenes[targetScenes.length - 1];
      return { id: scene.id, title: scene.title };
    };

    const previousScene =
      sceneIndex > 0
        ? { id: scenes[sceneIndex - 1].id, title: scenes[sceneIndex - 1].title }
        : adjacentSequenceScene(-1);
    const nextScene =
      sceneIndex < scenes.length - 1
        ? { id: scenes[sceneIndex + 1].id, title: scenes[sceneIndex + 1].title }
        : adjacentSequenceScene(1);

    return { previousScene, nextScene };
  }, [
    selection,
    screenplayNavigation.selectionContext,
    screenplayNavigation.scenesBySequenceId,
    screenplayNavigation.sequencesByActId,
  ]);

  const activeSaveNotification =
    selection.type === 'projectInformation'
      ? projectInformationAutosave
      : selection.type === 'scene'
        ? sceneSaveNotification?.sceneId === selection.id
          ? sceneSaveNotification.status
          : idleSaveNotification
        : undefined;
  const activeSceneHeaderAction =
    selection.type === 'scene' && sceneHeaderAction?.sceneId === selection.id
      ? sceneHeaderAction.action
      : null;
  const activeHeaderTitle =
    selection.type === 'scene' &&
    sceneHeaderTitle?.sceneId === selection.id &&
    sceneHeaderTitle.title
      ? sceneHeaderTitle.title
      : resolvedSelection.kicker;
  const activeSceneId = selection.type === 'scene' ? selection.id : null;
  const handleSceneHeaderActionChange = useCallback(
    (sceneId: string, action: ReactNode | null) => {
      setSceneHeaderAction((current) => {
        if (
          current &&
          current.sceneId === sceneId &&
          current.action === action
        ) {
          return current;
        }
        return { sceneId, action };
      });
    },
    []
  );
  const handleSceneSaveNotificationChange = useCallback(
    (sceneId: string, status: SaveNotificationStatus) => {
      setSceneSaveNotification((current) => {
        if (
          current &&
          current.sceneId === sceneId &&
          saveNotificationStatusesEqual(current.status, status)
        ) {
          return current;
        }
        return { sceneId, status };
      });
    },
    []
  );
  const handleSceneHeaderTitleChange = useCallback(
    (sceneId: string, title: string | null) => {
      setSceneHeaderTitle((current) => {
        if (
          current &&
          current.sceneId === sceneId &&
          current.title === title
        ) {
          return current;
        }
        return { sceneId, title };
      });
    },
    []
  );
  const handleActiveSceneHeaderActionChange = useCallback(
    (action: ReactNode | null) => {
      if (!activeSceneId) {
        return;
      }
      handleSceneHeaderActionChange(activeSceneId, action);
    },
    [activeSceneId, handleSceneHeaderActionChange]
  );
  const handleActiveSceneSaveNotificationChange = useCallback(
    (status: SaveNotificationStatus) => {
      if (!activeSceneId) {
        return;
      }
      handleSceneSaveNotificationChange(activeSceneId, status);
    },
    [activeSceneId, handleSceneSaveNotificationChange]
  );
  const handleActiveSceneHeaderTitleChange = useCallback(
    (title: string | null) => {
      if (!activeSceneId) {
        return;
      }
      handleSceneHeaderTitleChange(activeSceneId, title);
    },
    [activeSceneId, handleSceneHeaderTitleChange]
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

  const handleCreateInspirationFolder = useCallback(
    async (name: string) => {
      const folder = await createInspirationFolder(project.identity.name, name);
      handleInspirationFoldersChange();
      await onNavigateSelection({ type: 'inspiration', folderId: folder.id });
    },
    [handleInspirationFoldersChange, onNavigateSelection, project.identity.name]
  );

  return (
    <div className='h-screen w-screen bg-background text-foreground p-3 flex flex-col gap-3'>
      <main className='flex-1 min-h-0'>
        <ResizablePanelGroup
          id='movie-studio-shell-layout'
          autoSaveId='renku-studio.movie-studio.shell'
          direction='horizontal'
          className='min-h-0'
        >
          <ResizablePanel
            id='movie-studio-sidebar'
            defaultSize={MOVIE_STUDIO_LAYOUT.sidebarDefaultSizePercent}
            minSize={MOVIE_STUDIO_LAYOUT.sidebarMinSizePercent}
            maxSize={MOVIE_STUDIO_LAYOUT.sidebarMaxSizePercent}
            className='min-w-0'
          >
            <StudioSidebar
              project={project}
              screenplayNavigation={screenplayNavigation}
              selection={selection}
              onSelect={selectMovieStudioSurface}
              onHome={onHome}
              isProductionExportRunning={isProductionExportRunning}
              onProductionExport={handleProductionExport}
              lookbooksRevision={lookbooksRevision}
              inspirationFoldersRevision={inspirationFoldersRevision}
              onInspirationFoldersChange={handleInspirationFoldersChange}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id='movie-studio-details'
            defaultSize={MOVIE_STUDIO_LAYOUT.detailsDefaultSizePercent}
            minSize={MOVIE_STUDIO_LAYOUT.detailsMinSizePercent}
            className='min-w-0 pl-3'
          >
            <PanelShell
              title={activeHeaderTitle}
              contentClassName={
                usesFlushPanelContent(selection.type) ? 'p-0' : undefined
              }
              action={
                selection.type === 'inspiration' ? (
                  <InspirationFolderCreateDialog
                    trigger='icon'
                    onCreate={handleCreateInspirationFolder}
                  />
                ) : selection.type === 'scene' ? (
                  activeSceneHeaderAction
                ) : null
              }
              saveNotification={activeSaveNotification}
            >
              {selection.type === 'projectInformation' ? (
                <ProjectInformationPanel
                  project={project}
                  onProjectChange={onProjectChange}
                  onSaveStatusChange={handleProjectInformationSaveStatusChange}
                />
              ) : selection.type === 'inspiration' ||
                selection.type === 'lookbooks' ||
                selection.type === 'lookbook' ? (
                <VisualLanguagePanel
                  project={project}
                  selection={selection}
                  onSelect={selectMovieStudioSurface}
                  onLookbooksChange={handleLookbooksChange}
                  onInspirationFoldersChange={handleInspirationFoldersChange}
                  inspirationFoldersRevision={inspirationFoldersRevision}
                />
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
              ) : selection.type === 'act' ? (
                <ActStoryboardPanel
                  key={selection.id}
                  projectName={project.identity.name}
                  actId={selection.id}
                  onSelect={selectMovieStudioSurface}
                />
              ) : (
                <ScenePanel
                  key={selection.id}
                  projectName={project.identity.name}
                  sceneId={selection.id}
                  sceneTab={selection.sceneTab}
                  shotId={selection.shotId}
                  shotTab={selection.shotTab}
                  onSelect={selectMovieStudioSurface}
                  onHeaderActionChange={handleActiveSceneHeaderActionChange}
                  onHeaderTitleChange={handleActiveSceneHeaderTitleChange}
                  onSaveNotificationChange={handleActiveSceneSaveNotificationChange}
                  previousScene={sceneNeighbors.previousScene}
                  nextScene={sceneNeighbors.nextScene}
                />
              )}
            </PanelShell>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      <GenerationActivityFooter project={project} />
    </div>
  );
}


function usesFlushPanelContent(selectionType: StudioSelection['type']): boolean {
  return (
    selectionType === 'castMember' ||
    selectionType === 'inspiration' ||
    selectionType === 'location' ||
    selectionType === 'lookbook' ||
    selectionType === 'scene'
  );
}
