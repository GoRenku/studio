import { useEffect, useState } from 'react';
import type { ShotPlanDetailTab, StudioSelection } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/ui/resizable';
import type { StudioShot } from '@/services/studio-shot-plans-contracts';
import { ShotImageCandidatesDialog } from './shot-image-candidates-dialog';
import { ShotPlanShotContent } from './shot-plan-shot-content';
import { ShotPlanShotRail } from './shot-plan-shot-rail';
import { useSceneShotPlans } from './use-scene-shot-plans';
import { Tabs } from '@/ui/tabs';
import { LineTabBar } from '@/ui/line-tab-bar';
import { LineTabsContent } from '@/ui/line-tabs';
import { ShotPlanImageAssetsView } from './shot-plan-image-assets';
import { ShotPlanDialogueAudio } from './shot-plan-dialogue-audio';

// Resizable-panel proportions.
const SHOT_PLAN_RAIL_DEFAULT_WIDTH_PERCENT = 18;
const SHOT_PLAN_RAIL_MIN_WIDTH_PERCENT = 16;
const SHOT_PLAN_RAIL_MAX_WIDTH_PERCENT = 22;

// Hard pixel bounds keep the Shot rail readable at compact desktop widths.
const SHOT_PLAN_RAIL_MIN_WIDTH_PX = 210;
const SHOT_PLAN_RAIL_MAX_WIDTH_PX = 260;

export function ShotPlanDetailPage({
  projectName,
  sceneId,
  shotPlanId,
  shotPlanTab = 'shots',
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
  const [candidateShot, setCandidateShot] = useState<StudioShot | null>(null);
  const item =
    resource?.shotPlans.find(
      (candidate) => candidate.shotPlan.id === shotPlanId
    ) ?? null;
  const shot =
    item?.shotPlan.shots.find((candidate) => candidate.id === shotId) ?? null;

  useEffect(() => {
    if (!item || shotPlanTab !== 'shots' || shotId || !item.shotPlan.shots[0]) {
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
  }, [item, onSelect, sceneId, shotId, shotPlanId, shotPlanTab]);

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
            value={shotPlanTab}
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
            <LineTabBar items={shotPlanDetailTabs} />
            <LineTabsContent value='shots' className='mt-0 flex min-h-0 flex-1 overflow-hidden'>
            {item.shotPlan.shots.length === 0 ? (
              <p className='p-8 text-sm text-muted-foreground'>This Shot Plan has no Shots.</p>
            ) : (
            <ResizablePanelGroup
              direction='horizontal'
              className='min-h-0 flex-1'
            >
              <ResizablePanel
                defaultSize={SHOT_PLAN_RAIL_DEFAULT_WIDTH_PERCENT}
                minSize={SHOT_PLAN_RAIL_MIN_WIDTH_PERCENT}
                maxSize={SHOT_PLAN_RAIL_MAX_WIDTH_PERCENT}
                className='bg-sidebar-bg'
                style={{
                  minWidth: SHOT_PLAN_RAIL_MIN_WIDTH_PX,
                  maxWidth: SHOT_PLAN_RAIL_MAX_WIDTH_PX,
                }}
              >
                <ShotPlanShotRail
                  shotPlan={item.shotPlan}
                  selectedShotId={shotId}
                  onSelectShot={(nextShot) =>
                    onSelect({
                      type: 'scene',
                      id: sceneId,
                      sceneTab: 'shotPlans',
                      shotPlanId,
                      shotId: nextShot.id,
                    })
                  }
                  onManageImages={setCandidateShot}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={100 - SHOT_PLAN_RAIL_DEFAULT_WIDTH_PERCENT}
                minSize={100 - SHOT_PLAN_RAIL_MAX_WIDTH_PERCENT}
                maxSize={100 - SHOT_PLAN_RAIL_MIN_WIDTH_PERCENT}
                className='min-w-0'
              >
                {shot ? (
                  <ShotPlanShotContent
                    shot={shot}
                    coveredBeats={item.coveredBeats}
                  />
                ) : (
                  <p className='p-8 text-sm text-muted-foreground'>
                    Select a Shot to inspect its brief.
                  </p>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
            )}
            </LineTabsContent>
            <LineTabsContent value='assets' className='mt-0 min-h-0 flex-1 overflow-hidden'>
              <ShotPlanImageAssetsView projectName={projectName} shotPlanId={shotPlanId} />
            </LineTabsContent>
            <LineTabsContent value='audio' className='mt-0 min-h-0 flex-1 overflow-hidden'>
              <ShotPlanDialogueAudio projectName={projectName} shotPlanId={shotPlanId} />
            </LineTabsContent>
          </Tabs>
        </section>
      )}
      {item ? (
        <ShotImageCandidatesDialog
          projectName={projectName}
          sceneId={sceneId}
          shot={candidateShot}
          open={Boolean(candidateShot)}
          onOpenChange={(open) => {
            if (!open) {
              const shotNumber = candidateShot?.number;
              setCandidateShot(null);
              if (shotNumber) {
                requestAnimationFrame(() => {
                  const trigger = document.querySelector<HTMLButtonElement>(
                    `[aria-label="Manage images for Shot ${shotNumber}"]`
                  );
                  trigger?.focus();
                });
              }
            }
          }}
          onShotPlansChange={reload}
        />
      ) : null}
    </div>
  );
}

const shotPlanDetailTabs = [
  { value: 'shots', label: 'Shots' },
  { value: 'assets', label: 'Assets' },
  { value: 'audio', label: 'Audio' },
];
