import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import type {
  StudioShot,
  StudioShotPlanCoveredBeat,
} from '@/services/studio-shot-plans-contracts';
import type { ScreenplayEntityMentionCatalog } from '../screenplay-entity-mentions';
import { ShotBriefGrid } from './shot-brief-grid';
import { ShotDescriptionViewer } from './shot-description-viewer';
import { ShotPlanBeatLinks } from './shot-plan-beat-links';

export function ShotPlanShotContent({
  shot,
  coveredBeats = [],
  entityMentions,
}: {
  shot: StudioShot;
  coveredBeats?: StudioShotPlanCoveredBeat[];
  entityMentions: ScreenplayEntityMentionCatalog;
}) {
  const [tab, setTab] = useState<'brief' | 'description'>('brief');
  return (
    <div className='flex h-full min-h-0 flex-col px-6 py-5'>
      <div className='flex shrink-0 flex-col items-start'>
        <h2 className='text-xl font-semibold tracking-tight text-foreground'>
          {shot.title}
        </h2>
        {coveredBeats.length ? (
          <div className='mt-2'>
            <ShotPlanBeatLinks coveredBeats={coveredBeats} />
          </div>
        ) : null}
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'brief' | 'description')}
        className='mt-3 min-h-0 flex-1 gap-0'
      >
        <TabsList
          variant='line'
          className='h-10 w-full justify-start rounded-none border-b border-border/50 bg-transparent p-0'
        >
          <TabsTrigger
            value='brief'
            className='h-full flex-none rounded-none px-4 text-[10px] font-semibold uppercase tracking-[0.13em] after:!bottom-0 data-[state=active]:after:bg-primary'
          >
            Brief
          </TabsTrigger>
          <TabsTrigger
            value='description'
            className='h-full flex-none rounded-none px-4 text-[10px] font-semibold uppercase tracking-[0.13em] after:!bottom-0 data-[state=active]:after:bg-primary'
          >
            Description
          </TabsTrigger>
        </TabsList>
        {tab === 'brief' ? (
          <TabsContent
            value='brief'
            className='min-h-0 overflow-y-auto pt-4'
          >
            <ShotBriefGrid
              brief={shot.brief}
              entityMentions={entityMentions}
            />
          </TabsContent>
        ) : null}
        {tab === 'description' ? (
          <TabsContent
            value='description'
            className='min-h-0 overflow-hidden pt-4'
          >
            <ShotDescriptionViewer
              value={shot.description}
              entityMentions={entityMentions}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
