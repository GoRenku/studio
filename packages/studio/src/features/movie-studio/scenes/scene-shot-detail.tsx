import { useCallback, useEffect, useMemo } from 'react';
import type {
  SceneShot,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import type {
  SceneShotListResourceResponse,
} from '@/services/studio-project-contracts';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
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
  label: string;
  activeTab?: SceneShotDetailTab;
  castMemberLabels: Record<string, string>;
  castMemberImages?: NonNullable<SceneShotListResourceResponse['castMemberImages']>;
  locationLabels: Record<string, string>;
  onTabChange?: (tab: SceneShotDetailTab) => void;
  onCreateTake?: () => Promise<void>;
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
  label,
  activeTab = 'description',
  castMemberLabels,
  castMemberImages = {},
  locationLabels,
  onTabChange = () => {},
  onCreateTake,
  onTakeChange,
  onSaveNotificationChange,
}: SceneShotDetailProps) {
  const {
    saveNotification,
    setDetailSaveNotificationSlot,
  } = useDetailSaveNotificationSlots();
  const takeTag = useMemo(
    () =>
      take && take.shotIds.length > 1
        ? `${take.shotIds.length} shots`
        : null,
    [take]
  );
  const production = useShotVideoTakeProduction({
    projectName,
    sceneId,
    takeId: take?.takeId,
  });
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
            key={`${take?.takeId ?? 'shot-list'}:${shot.shotId}`}
            projectName={projectName}
            sceneId={sceneId}
            shot={shot}
            take={take}
            onSaved={onTakeChange}
            onSaveNotificationChange={handleShotDesignSaveNotificationChange}
          >
            <LineTabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as SceneShotDetailTab)}
              className='flex h-full min-h-0 min-w-0 flex-col gap-0'
              items={DESIGN_TABS.map((tab) => ({ ...tab }))}
              trailing={
                takeTag ? (
                  <SceneShotAiProductionTakeTag
                    label={takeTag}
                  />
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
                    castMemberImages={castMemberImages}
                    productionPlan={production.productionPlan}
                    onPlanRefresh={production.refreshProductionPlan}
                    onSaveNotificationChange={handleDialogsSaveNotificationChange}
                  />
                </LineTabsContent>
                <LineTabsContent value='references'>
                  <SceneShotReferencesTab
                    projectName={projectName}
                    sceneId={sceneId}
                    productionPlan={production.productionPlan}
                    onPlanRefresh={production.refreshProductionPlan}
                    onSaveNotificationChange={handleReferencesSaveNotificationChange}
                  />
                </LineTabsContent>
                <LineTabsContent value='ai-production' className='h-full'>
                  <SceneShotAiProductionTab
                    production={production}
                    onCreateTake={onCreateTake}
                  />
                </LineTabsContent>
              </div>
            </LineTabs>
          </TakeShotDesignProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
