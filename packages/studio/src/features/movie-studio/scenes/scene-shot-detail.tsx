import { useMemo } from 'react';
import type {
  SceneShot,
  ShotVideoTakeProductionGroup,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { LineTabBar } from '@/ui/line-tab-bar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/ui/resizable';
import { Tabs, TabsContent } from '@/ui/tabs';
import { SceneShotVideoStage } from './scene-shot-video-stage';
import { SceneShotDescriptionTab } from './scene-shot-description-tab';
import { SceneShotCompositionTab } from './scene-shot-composition-tab';
import { SceneShotCameraMotionTab } from './scene-shot-camera-motion-tab';
import { SceneShotLocationTab } from './scene-shot-location-tab';
import { SceneShotAiProductionTab } from './scene-shot-ai-production-tab';
import { SceneShotAiProductionGroupTag } from './scene-shot-ai-production-group-tag';
import { ShotSpecsProvider } from './shot-specs-context';
import { findGroupForShot, groupTagLabel } from './shot-video-take-grouping';

interface SceneShotDetailProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  shots: SceneShot[];
  productionGroups: ShotVideoTakeProductionGroup[];
  label: string;
  castMemberLabels: Record<string, string>;
  locationLabels: Record<string, string>;
  onShotSpecsSaved?: (resource: SceneShotListResourceResponse) => void;
}

const DESIGN_TABS = [
  { value: 'description', label: 'Description' },
  { value: 'composition', label: 'Composition' },
  { value: 'camera-motion', label: 'Camera Motion' },
  { value: 'location', label: 'Location' },
  { value: 'ai-production', label: 'AI Production' },
] as const;

export function SceneShotDetail({
  projectName,
  sceneId,
  shot,
  shots,
  productionGroups,
  label,
  castMemberLabels,
  locationLabels,
  onShotSpecsSaved,
}: SceneShotDetailProps) {
  const groupTag = useMemo(() => {
    const group = findGroupForShot(productionGroups, shot.shotId);
    return groupTagLabel(shots, group);
  }, [productionGroups, shot.shotId, shots]);

  return (
    <section className='flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-muted/40'>
      <ResizablePanelGroup direction='vertical' className='min-h-0 flex-1'>
        <ResizablePanel defaultSize={42} minSize={20} className='p-4'>
          <SceneShotVideoStage />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={58} minSize={25} className='min-h-0'>
          <ShotSpecsProvider
            key={shot.shotId}
            projectName={projectName}
            sceneId={sceneId}
            shot={shot}
            onSaved={onShotSpecsSaved}
          >
            <Tabs
              defaultValue='description'
              className='flex h-full min-h-0 flex-col gap-0'
            >
              <LineTabBar
                items={DESIGN_TABS.map((tab) => ({ ...tab }))}
                trailing={
                  groupTag ? (
                    <SceneShotAiProductionGroupTag label={groupTag} />
                  ) : null
                }
              />
              <div className='min-h-0 flex-1 overflow-y-auto bg-panel-bg px-4'>
                <TabsContent value='description'>
                  <SceneShotDescriptionTab
                    shot={shot}
                    label={label}
                    castMemberLabels={castMemberLabels}
                    locationLabels={locationLabels}
                  />
                </TabsContent>
                <TabsContent value='composition'>
                  <SceneShotCompositionTab />
                </TabsContent>
                <TabsContent value='camera-motion'>
                  <SceneShotCameraMotionTab />
                </TabsContent>
                <TabsContent value='location'>
                  <SceneShotLocationTab
                    projectName={projectName}
                    shot={shot}
                    locationLabels={locationLabels}
                  />
                </TabsContent>
                <TabsContent value='ai-production' className='h-full'>
                  <SceneShotAiProductionTab
                    projectName={projectName}
                    sceneId={sceneId}
                    shot={shot}
                    productionGroups={productionGroups}
                    onResourceRefreshed={onShotSpecsSaved}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </ShotSpecsProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
