import type { SceneShot } from '@gorenku/studio-core/client';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import { SceneShotVideoStage } from './scene-shot-video-stage';
import { SceneShotDescriptionTab } from './scene-shot-description-tab';
import { SceneShotDetailTabPlaceholder } from './scene-shot-detail-tab-placeholder';

interface SceneShotDetailProps {
  shot: SceneShot;
  label: string;
  castMemberLabels: Record<string, string>;
  locationLabels: Record<string, string>;
}

const DESIGN_TABS = [
  { value: 'description', label: 'Description' },
  { value: 'camera-framing', label: 'Camera Framing' },
  { value: 'camera-motion', label: 'Camera Motion' },
  { value: 'location', label: 'Location' },
  { value: 'camera-type', label: 'Camera Type' },
] as const;

export function SceneShotDetail({
  shot,
  label,
  castMemberLabels,
  locationLabels,
}: SceneShotDetailProps) {
  return (
    <section className='flex min-w-0 flex-1 flex-col gap-4 rounded-xl border border-border/40 bg-muted/40 p-4'>
      <SceneShotVideoStage />
      <Tabs defaultValue='description' className='flex min-h-0 flex-1 flex-col gap-0'>
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
          <TabsContent value='camera-framing'>
            <SceneShotDetailTabPlaceholder />
          </TabsContent>
          <TabsContent value='camera-motion'>
            <SceneShotDetailTabPlaceholder />
          </TabsContent>
          <TabsContent value='location'>
            <SceneShotDetailTabPlaceholder />
          </TabsContent>
          <TabsContent value='camera-type'>
            <SceneShotDetailTabPlaceholder />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
