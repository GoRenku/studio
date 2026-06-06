import { useMemo } from 'react';
import type {
  SceneShot,
  ShotVideoTakeProductionGroup,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/ui/resizable';
import { SceneShotVideoStage } from './scene-shot-video-stage';
import { SceneShotDescriptionTab } from './scene-shot-description-tab';
import { SceneShotCompositionTab } from './scene-shot-composition-tab';
import { SceneShotCameraMotionTab } from './scene-shot-camera-motion-tab';
import { SceneShotLocationTab } from './scene-shot-location-tab';
import { SceneShotAiProductionTab } from './scene-shot-ai-production-tab';
import { SceneShotAiProductionGroupTag } from './scene-shot-ai-production-group-tag';
import { SceneShotCastTab } from './scene-shot-cast-tab';
import { SceneShotLookbookTab } from './scene-shot-lookbook-tab';
import { SceneShotReferencesTab } from './scene-shot-references-tab';
import { ShotSpecsProvider } from './shot-specs-context';
import {
  findRailGroupForShot,
  groupTagLabel,
  type ShotRailGroupDraft,
} from './shot-video-take-grouping';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';

interface SceneShotDetailProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  shots: SceneShot[];
  railGroups: ShotRailGroupDraft[];
  productionGroups: ShotVideoTakeProductionGroup[];
  label: string;
  castMemberLabels: Record<string, string>;
  locationLabels: Record<string, string>;
  onShotSpecsSaved?: (resource: SceneShotListResourceResponse) => void;
}

const DESIGN_TABS = [
  { value: 'description', label: 'Description' },
  { value: 'lookbook', label: 'Lookbook' },
  { value: 'composition', label: 'Composition' },
  { value: 'motion', label: 'Motion' },
  { value: 'cast', label: 'Cast' },
  { value: 'location', label: 'Location' },
  { value: 'references', label: 'References' },
  { value: 'ai-production', label: 'AI Production' },
] as const;

export function SceneShotDetail({
  projectName,
  sceneId,
  shot,
  shots,
  railGroups,
  productionGroups,
  label,
  castMemberLabels,
  locationLabels,
  onShotSpecsSaved,
}: SceneShotDetailProps) {
  const groupTag = useMemo(() => {
    const group = findRailGroupForShot(railGroups, shot.shotId);
    return groupTagLabel(shots, group);
  }, [railGroups, shot.shotId, shots]);
  const visibleRailGroup = useMemo(
    () => findRailGroupForShot(railGroups, shot.shotId),
    [railGroups, shot.shotId]
  );
  const singleShotProductionGroup = useMemo(
    () =>
      productionGroups.find(
        (group) =>
          group.shotIds.length === 1 && group.shotIds[0] === shot.shotId
      ) ?? null,
    [productionGroups, shot.shotId]
  );
  const shotIdsKey = (
    visibleRailGroup?.shotIds ??
    singleShotProductionGroup?.shotIds ??
    [shot.shotId]
  ).join(',');
  const productionGroupIdKey =
    visibleRailGroup?.productionGroupId ??
    singleShotProductionGroup?.productionGroupId ??
    null;
  const production = useShotVideoTakeProduction({
    projectName,
    sceneId,
    shotIds: shotIdsKey.split(','),
    productionGroupId: productionGroupIdKey,
    onResourceRefreshed: onShotSpecsSaved,
  });

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
          >
            <LineTabs
              defaultValue='description'
              className='flex h-full min-h-0 min-w-0 flex-col gap-0'
              items={DESIGN_TABS.map((tab) => ({ ...tab }))}
              trailing={
                groupTag ? <SceneShotAiProductionGroupTag label={groupTag} /> : null
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
                <LineTabsContent value='lookbook'>
                  <SceneShotLookbookTab
                    projectName={projectName}
                    sceneId={sceneId}
                    shot={shot}
                    productionPlan={production.productionPlan}
                    onResourceRefreshed={onShotSpecsSaved}
                    onPlanRefresh={production.refreshProductionPlan}
                  />
                </LineTabsContent>
                <LineTabsContent value='composition'>
                  <SceneShotCompositionTab />
                </LineTabsContent>
                <LineTabsContent value='motion'>
                  <SceneShotCameraMotionTab />
                </LineTabsContent>
                <LineTabsContent value='cast'>
                  <SceneShotCastTab
                    projectName={projectName}
                    sceneId={sceneId}
                    shot={shot}
                    productionPlan={production.productionPlan}
                    onResourceRefreshed={onShotSpecsSaved}
                    onPlanRefresh={production.refreshProductionPlan}
                  />
                </LineTabsContent>
                <LineTabsContent value='location'>
                  <SceneShotLocationTab
                    projectName={projectName}
                    sceneId={sceneId}
                    shot={shot}
                    productionPlan={production.productionPlan}
                    onResourceRefreshed={onShotSpecsSaved}
                    onPlanRefresh={production.refreshProductionPlan}
                  />
                </LineTabsContent>
                <LineTabsContent value='references'>
                  <SceneShotReferencesTab
                    projectName={projectName}
                    sceneId={sceneId}
                    productionPlan={production.productionPlan}
                  />
                </LineTabsContent>
                <LineTabsContent value='ai-production' className='h-full'>
                  <SceneShotAiProductionTab production={production} />
                </LineTabsContent>
              </div>
            </LineTabs>
          </ShotSpecsProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
