import type { SceneShot } from '@gorenku/studio-core/client';
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
import { ShotSpecsProvider } from './shot-specs-context';

interface SceneShotDetailProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
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
] as const;

export function SceneShotDetail({
  projectName,
  sceneId,
  shot,
  label,
  castMemberLabels,
  locationLabels,
  onShotSpecsSaved,
}: SceneShotDetailProps) {
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
              <LineTabBar items={DESIGN_TABS.map((tab) => ({ ...tab }))} />
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
              </div>
            </Tabs>
          </ShotSpecsProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
