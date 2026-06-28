import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  SceneShot,
  SceneShotVideoTake,
  SceneShotVideoTakeStructureMode,
} from '@gorenku/studio-core/client';
import { Film, Route } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import type {
  SceneShotListResourceResponse,
} from '@/services/studio-project-contracts';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import { updateSceneShotVideoTakeStructureMode } from '@/services/studio-shot-video-takes-api';
import type { SceneShotDetailTab } from '../movie-studio-selection';
import { idleSaveNotification } from '../detail-save-notification';
import { useDetailSaveNotificationSlots } from '../detail-save-notification-slots';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/ui/resizable';
import { SceneShotVideoStage } from './scene-shot-video-stage';
import { SceneShotDescriptionTab } from './scene-shot-description-tab';
import { SceneShotCompositionTab } from './scene-shot-composition-tab';
import { SceneShotCameraMotionTab } from './scene-shot-camera-motion-tab';
import { SceneShotAiProductionTab } from './scene-shot-ai-production-tab';
import { SceneShotAiProductionTakeTag } from './scene-shot-ai-production-take-tag';
import { SceneShotReferencesTab } from './scene-shot-references-tab';
import { SceneShotDialogsTab } from './scene-shot-dialogs-tab';
import { TakeShotDesignProvider } from './take-shot-design-context';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';

interface SceneShotDetailProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  take: SceneShotVideoTake | null;
  isShotEditable: boolean;
  label: string;
  activeTab?: SceneShotDetailTab;
  castMemberLabels: Record<string, string>;
  castMemberImages?: NonNullable<SceneShotListResourceResponse['castMemberImages']>;
  locationLabels: Record<string, string>;
  onTabChange?: (tab: SceneShotDetailTab) => void;
  onCreateTake?: () => Promise<void>;
  createTakePending?: boolean;
  onTakeChange?: (take: SceneShotVideoTake) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

const DESIGN_TABS = [
  { value: 'description', label: 'Description' },
  { value: 'composition', label: 'Composition' },
  { value: 'motion', label: 'Motion' },
  { value: 'dialogs', label: 'Dialogs' },
  { value: 'references', label: 'References' },
  { value: 'ai-production', label: 'AI Production' },
] as const;

export function SceneShotDetail({
  projectName,
  sceneId,
  shot,
  take,
  isShotEditable,
  label,
  activeTab = 'description',
  castMemberLabels,
  castMemberImages = {},
  locationLabels,
  onTabChange = () => {},
  onCreateTake,
  createTakePending = false,
  onTakeChange,
  onSaveNotificationChange,
}: SceneShotDetailProps) {
  const {
    saveNotification,
    setDetailSaveNotificationSlot,
  } = useDetailSaveNotificationSlots();
  const editableTake = isShotEditable ? take : null;
  const visibleTabs = isShotEditable
    ? DESIGN_TABS
    : DESIGN_TABS.filter((tab) => tab.value === 'description');
  const visibleActiveTab = isShotEditable ? activeTab : 'description';
  const takeTag = useMemo(
    () =>
      editableTake && editableTake.shotIds.length > 1
        ? `${editableTake.shotIds.length} shots`
        : null,
    [editableTake]
  );
  const production = useShotVideoTakeProduction({
    projectName,
    sceneId,
    takeId: editableTake?.takeId,
    selectedShotId: shot.shotId,
  });
  const { refreshProductionPlan } = production;
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [structureBusy, setStructureBusy] = useState(false);
  const handleShotDesignSaveNotificationChange = useCallback(
    (status: SaveNotificationStatus) => {
      setDetailSaveNotificationSlot('shot-design', status);
    },
    [setDetailSaveNotificationSlot]
  );
  const handleDialogsSaveNotificationChange = useCallback(
    (status: SaveNotificationStatus) => {
      setDetailSaveNotificationSlot('dialogs', status);
    },
    [setDetailSaveNotificationSlot]
  );
  const handleReferencesSaveNotificationChange = useCallback(
    (status: SaveNotificationStatus) => {
      setDetailSaveNotificationSlot('references', status);
    },
    [setDetailSaveNotificationSlot]
  );

  useEffect(() => {
    setDetailSaveNotificationSlot('ai-production', production.autosave);
  }, [production.autosave, setDetailSaveNotificationSlot]);

  useEffect(() => {
    onSaveNotificationChange?.(saveNotification);
    return () => onSaveNotificationChange?.(idleSaveNotification);
  }, [onSaveNotificationChange, saveNotification]);

  useEffect(() => {
    if (!isShotEditable && activeTab !== 'description') {
      onTabChange('description');
    }
  }, [activeTab, isShotEditable, onTabChange]);

  const handleStructureModeChange = useCallback(
    async (
      mode: SceneShotVideoTakeStructureMode,
      sourceShotId?: string
    ) => {
      if (!editableTake || editableTake.state.structure.mode === mode) {
        return;
      }
      setStructureBusy(true);
      try {
        const result = await updateSceneShotVideoTakeStructureMode(
          projectName,
          sceneId,
          editableTake.takeId,
          mode,
          sourceShotId
        );
        onTakeChange?.(result.context.take);
        await refreshProductionPlan();
        setStructureDialogOpen(false);
      } catch (error) {
        if (
          mode === 'continuous' &&
          error instanceof Error &&
          error.message.includes(
            'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT'
          )
        ) {
          setStructureDialogOpen(true);
          return;
        }
        throw error;
      } finally {
        setStructureBusy(false);
      }
    },
    [
      editableTake,
      onTakeChange,
      projectName,
      refreshProductionPlan,
      sceneId,
      setStructureDialogOpen,
      setStructureBusy,
    ]
  );

  return (
    <section className='flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-muted/40'>
      <ResizablePanelGroup
        id='scene-shot-detail-layout'
        autoSaveId='renku-studio.scene-shot-detail.layout'
        direction='vertical'
        className='min-h-0 flex-1'
      >
        <ResizablePanel
          id='scene-shot-video-stage'
          defaultSize={42}
          minSize={20}
          className='p-4'
        >
          <SceneShotVideoStage />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id='scene-shot-design-tabs'
          defaultSize={58}
          minSize={25}
          className='min-h-0'
        >
          <TakeShotDesignProvider
            projectName={projectName}
            sceneId={sceneId}
            shot={shot}
            take={editableTake}
            onSaved={onTakeChange}
            onSaveNotificationChange={handleShotDesignSaveNotificationChange}
          >
            <LineTabs
              value={visibleActiveTab}
              onValueChange={(value) => onTabChange(value as SceneShotDetailTab)}
              className='flex h-full min-h-0 min-w-0 flex-col gap-0'
              items={visibleTabs.map((tab) => ({ ...tab }))}
              trailing={
                takeTag ? (
                  <div className='flex items-center gap-2'>
                    <SceneShotAiProductionTakeTag label={takeTag} />
                    {editableTake ? (
                      <ShotVideoTakeStructureToggle
                        mode={editableTake.state.structure.mode}
                        disabled={structureBusy}
                        onChange={(mode) => {
                          void handleStructureModeChange(mode);
                        }}
                      />
                    ) : null}
                  </div>
                ) : null
              }
            >
              <div className='min-h-0 min-w-0 flex-1 overflow-y-auto bg-panel-bg px-4'>
                <LineTabsContent value='description'>
                  <SceneShotDescriptionTab
                    shot={shot}
                    label={label}
                    castMemberLabels={castMemberLabels}
                    locationLabels={locationLabels}
                  />
                </LineTabsContent>
                {isShotEditable ? (
                  <>
                    <LineTabsContent value='composition'>
                      <SceneShotCompositionTab />
                    </LineTabsContent>
                    <LineTabsContent value='motion'>
                      <SceneShotCameraMotionTab />
                    </LineTabsContent>
                    <LineTabsContent value='dialogs'>
                      <SceneShotDialogsTab
                        projectName={projectName}
                        sceneId={sceneId}
                        selectedShotId={shot.shotId}
                        castMemberImages={castMemberImages}
                        productionPlan={production.productionPlan}
                        onPlanRefresh={refreshProductionPlan}
                        onSaveNotificationChange={handleDialogsSaveNotificationChange}
                      />
                    </LineTabsContent>
                    <LineTabsContent value='references'>
                      <SceneShotReferencesTab
                        projectName={projectName}
                        sceneId={sceneId}
                        selectedShotId={shot.shotId}
                        productionPlan={production.productionPlan}
                        onPlanRefresh={refreshProductionPlan}
                        onSaveNotificationChange={handleReferencesSaveNotificationChange}
                      />
                    </LineTabsContent>
                    <LineTabsContent value='ai-production' className='h-full'>
                      <SceneShotAiProductionTab
                        production={production}
                        onCreateTake={onCreateTake}
                        createTakePending={createTakePending}
                      />
                    </LineTabsContent>
                  </>
                ) : null}
              </div>
            </LineTabs>
          </TakeShotDesignProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
      {editableTake ? (
        <ShotVideoTakeStructureSourceDialog
          open={structureDialogOpen}
          busy={structureBusy}
          take={editableTake}
          onOpenChange={setStructureDialogOpen}
          onChoose={(sourceShotId) => {
            void handleStructureModeChange('continuous', sourceShotId);
          }}
        />
      ) : null}
    </section>
  );
}

function ShotVideoTakeStructureToggle({
  mode,
  disabled,
  onChange,
}: {
  mode: SceneShotVideoTakeStructureMode;
  disabled: boolean;
  onChange: (mode: SceneShotVideoTakeStructureMode) => void;
}) {
  return (
    <div className='inline-flex h-7 items-center gap-0.5 rounded-md border border-border/50 bg-background/70 p-0.5'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            size='icon'
            variant={mode === 'continuous' ? 'secondary' : 'ghost'}
            className='h-6 w-7 rounded-[5px]'
            aria-label='Continuous Move'
            disabled={disabled}
            onClick={() => onChange('continuous')}
          >
            <Route className='h-3.5 w-3.5' aria-hidden='true' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='bottom'>Continuous Move</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            size='icon'
            variant={mode === 'multi-cut' ? 'secondary' : 'ghost'}
            className='h-6 w-7 rounded-[5px]'
            aria-label='Multi-Cut Sequence'
            disabled={disabled}
            onClick={() => onChange('multi-cut')}
          >
            <Film className='h-3.5 w-3.5' aria-hidden='true' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='bottom'>Multi-Cut Sequence</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ShotVideoTakeStructureSourceDialog({
  open,
  busy,
  take,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  busy: boolean;
  take: SceneShotVideoTake;
  onOpenChange: (open: boolean) => void;
  onChoose: (sourceShotId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Choose Continuous Move Direction</DialogTitle>
          <DialogDescription>
            This take has different settings per shot. Choose which shot should
            become the shared Continuous Move direction.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='flex-wrap gap-2 sm:justify-start'>
          {take.shotIds.map((shotId, index) => (
            <Button
              key={shotId}
              type='button'
              variant='secondary'
              disabled={busy}
              onClick={() => onChoose(shotId)}
            >
              Use Shot {index + 1}
            </Button>
          ))}
          <Button
            type='button'
            variant='ghost'
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
