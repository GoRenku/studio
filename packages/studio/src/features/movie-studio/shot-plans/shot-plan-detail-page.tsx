import { useEffect } from 'react';
import type { ShotPlanDetailTab, StudioSelection } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { ShotListTab } from './shot-list-tab';
import { PrevisTab } from './previs/previs-tab';
import { useSceneShotPlans } from './use-scene-shot-plans';
import { Tabs } from '@/ui/tabs';
import { LineTabBar } from '@/ui/line-tab-bar';
import { LineTabsContent } from '@/ui/line-tabs';
import { ShotPlanAssetsView } from './shot-plan-assets';
import { ShotPlanDialogueAudio } from './shot-plan-dialogue-audio';

export function ShotPlanDetailPage({
  projectName,
  sceneId,
  shotPlanId,
  shotPlanTab,
  shotId,
  onSelect,
}: {
  projectName: string;
  sceneId: string;
  shotPlanId: string;
  shotPlanTab?: ShotPlanDetailTab;
  shotId?: string;
  onSelect: (selection: StudioSelection) => void;
}) {
  const { resource, error, reload } = useSceneShotPlans(projectName, sceneId);
  const item =
    resource?.shotPlans.find(
      (candidate) => candidate.shotPlan.id === shotPlanId
    ) ?? null;
  const primaryTab = item?.shotPlan.type === 'previs' ? 'previs' : 'shots';
  const selectedTab = shotPlanTab ?? primaryTab;
  const invalidSelection = Boolean(item && ((selectedTab === 'shots' && primaryTab !== 'shots')
    || (selectedTab === 'previs' && primaryTab !== 'previs') || (shotId && primaryTab === 'previs')));

  useEffect(() => {
    if (!item || primaryTab !== 'shots' || selectedTab !== 'shots' || shotId || !item.shotPlan.shots[0]) {
      return;
    }
    onSelect({
      type: 'scene',
      id: sceneId,
      sceneTab: 'shotPlans',
      shotPlanId,
      shotPlanTab: 'shots',
      shotId: item.shotPlan.shots[0].id,
    });
  }, [item, onSelect, sceneId, shotId, shotPlanId, primaryTab, selectedTab]);

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-1 flex-col'>
      {error ? (
        <div className='flex flex-1 flex-col items-start justify-center gap-3'>
          <p className='text-sm text-destructive'>{error}</p>
          <Button type='button' variant='outline' size='sm' onClick={reload}>
            Retry
          </Button>
        </div>
      ) : !resource ? (
        <p className='p-8 text-sm text-muted-foreground'>
          Loading Shot Plan...
        </p>
      ) : !item ? (
        <div className='flex flex-1 flex-col items-start justify-center gap-3'>
          <p className='text-sm text-muted-foreground'>
            This Shot Plan is no longer available.
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              onSelect({
                type: 'scene',
                id: sceneId,
                sceneTab: 'shotPlans',
              })
            }
          >
            Back to Shot Plans
          </Button>
        </div>
      ) : (
        <section className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          <Tabs
            value={selectedTab}
            onValueChange={(value) => onSelect({
              type: 'scene',
              id: sceneId,
              sceneTab: 'shotPlans',
              shotPlanId,
              shotPlanTab: value as ShotPlanDetailTab,
              ...(value === 'shots' && shotId ? { shotId } : {}),
            })}
            className='flex min-h-0 flex-1 flex-col'
          >
            <LineTabBar items={[{ value: primaryTab, label: primaryTab === 'previs' ? 'Previs' : 'Shots' }, ...shotPlanDetailTabs]} />
            {invalidSelection ? <p role='alert' className='p-8 text-sm text-destructive'>This selection is not available for this Shot Plan.</p> : null}
            <LineTabsContent value='shots' className='mt-0 flex min-h-0 flex-1 overflow-hidden'>
              {!invalidSelection ? <ShotListTab projectName={projectName} sceneId={sceneId} item={item} shotId={shotId} onSelect={onSelect} reload={reload} /> : null}
            </LineTabsContent>
            <LineTabsContent value='previs' className='mt-0 min-h-0 flex-1 overflow-hidden'>
              {!invalidSelection ? <PrevisTab key={shotPlanId} projectName={projectName} sceneId={sceneId} shotPlanId={shotPlanId} /> : null}
            </LineTabsContent>
            <LineTabsContent value='assets' className='mt-0 min-h-0 flex-1 overflow-hidden'>
              <ShotPlanAssetsView projectName={projectName} shotPlanId={shotPlanId} />
            </LineTabsContent>
            <LineTabsContent value='audio' className='mt-0 min-h-0 flex-1 overflow-hidden'>
              <ShotPlanDialogueAudio projectName={projectName} shotPlanId={shotPlanId} />
            </LineTabsContent>
          </Tabs>
        </section>
      )}

    </div>
  );
}

const shotPlanDetailTabs = [
  { value: 'assets', label: 'Assets' },
  { value: 'audio', label: 'Audio' },
];
