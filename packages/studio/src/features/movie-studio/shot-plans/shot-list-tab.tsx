import { useState } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/resizable';
import type { StudioShot, StudioShotPlanListItem } from '@/services/studio-shot-plans-contracts';
import { ShotImageCandidatesDialog } from './shot-image-candidates-dialog';
import { ShotPlanShotContent } from './shot-plan-shot-content';
import { ShotPlanShotRail } from './shot-plan-shot-rail';

// Resizable-panel proportions.
const SHOT_PLAN_RAIL_DEFAULT_WIDTH_PERCENT = 18;
const SHOT_PLAN_RAIL_MIN_WIDTH_PERCENT = 16;
const SHOT_PLAN_RAIL_MAX_WIDTH_PERCENT = 22;

// Hard pixel bounds keep the Shot rail readable at compact desktop widths.
const SHOT_PLAN_RAIL_MIN_WIDTH_PX = 210;
const SHOT_PLAN_RAIL_MAX_WIDTH_PX = 260;

export function ShotListTab({ projectName, sceneId, item, shotId, onSelect, reload }: {
  projectName: string;
  sceneId: string;
  item: StudioShotPlanListItem;
  shotId?: string;
  onSelect: (selection: StudioSelection) => void;
  reload: () => void;
}) {
  const shotPlanId = item.shotPlan.id;
  const shot = item.shotPlan.shots.find((candidate) => candidate.id === shotId) ?? null;
  const [candidateShot, setCandidateShot] = useState<StudioShot | null>(null);
  return <>
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
  </>;
}
