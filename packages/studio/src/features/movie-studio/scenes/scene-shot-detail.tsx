import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SceneShot,
  SceneShotVideoTakeGeneration,
} from '@gorenku/studio-core/client';
import type {
  SceneShotListResourceResponse,
} from '@/services/studio-project-contracts';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type { SceneShotDetailTab } from '../movie-studio-selection';
import {
  chooseDetailSaveNotification,
  idleSaveNotification,
  idleSaveNotificationSlot,
  saveNotificationStatusesEqual,
  type DetailSaveNotificationSlot,
} from '../detail-save-notification';
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
import { SceneShotAiProductionTakeGenerationTag } from './scene-shot-ai-production-take-generation-tag';
import { SceneShotReferencesTab } from './scene-shot-references-tab';
import { SceneShotDialogsTab } from './scene-shot-dialogs-tab';
import { ShotSpecsProvider } from './shot-specs-context';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';

interface SceneShotDetailProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  takeGeneration: SceneShotVideoTakeGeneration | null;
  label: string;
  activeTab?: SceneShotDetailTab;
  castMemberLabels: Record<string, string>;
  castMemberImages?: NonNullable<SceneShotListResourceResponse['castMemberImages']>;
  locationLabels: Record<string, string>;
  onTabChange?: (tab: SceneShotDetailTab) => void;
  onShotSpecsSaved?: (resource: SceneShotListResourceResponse) => void;
  onCreateTakeGeneration?: () => Promise<void>;
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
  takeGeneration,
  label,
  activeTab = 'description',
  castMemberLabels,
  castMemberImages = {},
  locationLabels,
  onTabChange = () => {},
  onShotSpecsSaved,
  onCreateTakeGeneration,
  onSaveNotificationChange,
}: SceneShotDetailProps) {
  const saveNotificationSequenceRef = useRef(0);
  const [shotSpecsSaveNotification, setShotSpecsSaveNotification] =
    useState<DetailSaveNotificationSlot>(idleSaveNotificationSlot);
  const [productionSaveNotification, setProductionSaveNotification] =
    useState<DetailSaveNotificationSlot>(idleSaveNotificationSlot);
  const takeGenerationTag = useMemo(
    () =>
      takeGeneration && takeGeneration.shotIds.length > 1
        ? `${takeGeneration.shotIds.length} shots`
        : null,
    [takeGeneration]
  );
  const production = useShotVideoTakeProduction({
    projectName,
    sceneId,
    takeGenerationId: takeGeneration?.takeGenerationId,
    onResourceRefreshed: onShotSpecsSaved,
  });
  const handleShotSpecsSaveNotificationChange = useCallback(
    (status: SaveNotificationStatus) => {
      setShotSpecsSaveNotification((current) => {
        if (saveNotificationStatusesEqual(current.status, status)) {
          return current;
        }
        return {
          status,
          sequence: ++saveNotificationSequenceRef.current,
        };
      });
    },
    []
  );

  useEffect(() => {
    setProductionSaveNotification((current) => {
      if (saveNotificationStatusesEqual(current.status, production.autosave)) {
        return current;
      }
      return {
        status: production.autosave,
        sequence: ++saveNotificationSequenceRef.current,
      };
    });
  }, [production.autosave]);

  const saveNotification = useMemo(
    () =>
      chooseDetailSaveNotification([
        shotSpecsSaveNotification,
        productionSaveNotification,
      ]),
    [productionSaveNotification, shotSpecsSaveNotification]
  );

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
          <ShotSpecsProvider
            key={shot.shotId}
            projectName={projectName}
            sceneId={sceneId}
            shot={shot}
            onSaved={onShotSpecsSaved}
            onSaveNotificationChange={handleShotSpecsSaveNotificationChange}
          >
            <LineTabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value as SceneShotDetailTab)}
              className='flex h-full min-h-0 min-w-0 flex-col gap-0'
              items={DESIGN_TABS.map((tab) => ({ ...tab }))}
              trailing={
                takeGenerationTag ? (
                  <SceneShotAiProductionTakeGenerationTag
                    label={takeGenerationTag}
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
                    onResourceRefreshed={onShotSpecsSaved}
                    onPlanRefresh={production.refreshProductionPlan}
                  />
                </LineTabsContent>
                <LineTabsContent value='references'>
                  <SceneShotReferencesTab
                    projectName={projectName}
                    sceneId={sceneId}
                    shot={shot}
                    productionPlan={production.productionPlan}
                    onResourceRefreshed={onShotSpecsSaved}
                    onPlanRefresh={production.refreshProductionPlan}
                  />
                </LineTabsContent>
                <LineTabsContent value='ai-production' className='h-full'>
                  <SceneShotAiProductionTab
                    production={production}
                    onCreateTakeGeneration={onCreateTakeGeneration}
                  />
                </LineTabsContent>
              </div>
            </LineTabs>
          </ShotSpecsProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
