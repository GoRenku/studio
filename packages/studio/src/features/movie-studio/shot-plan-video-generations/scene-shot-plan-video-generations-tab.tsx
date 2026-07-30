import { Button } from '@/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/ui/accordion';
import { ShotPlanVideoGenerationGroup } from './shot-plan-video-generation-group';
import { useSceneShotPlanVideoGenerations } from './use-scene-shot-plan-video-generations';
import type { StudioSceneShotPlanVideoGenerations } from '@/services/studio-shot-plan-video-generations-contracts';

export function SceneShotPlanVideoGenerationsTab({
  projectName,
  sceneId,
}: {
  projectName: string;
  sceneId: string;
}) {
  const { resource, error, loading, retry } =
    useSceneShotPlanVideoGenerations(projectName, sceneId);

  if (loading) {
    return (
      <p className='p-6 text-sm text-muted-foreground'>
        Loading generations...
      </p>
    );
  }
  if (error) {
    return (
      <div className='space-y-3 p-6'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button type='button' variant='outline' onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }
  if (!resource?.groups.length) {
    return (
      <p className='p-6 text-sm text-muted-foreground'>
        No generated videos yet.
      </p>
    );
  }

  return (
    <div className='min-h-0 flex-1 overflow-y-auto bg-panel-bg px-6 py-4'>
      <Accordion
        type='multiple'
        defaultValue={[groupKey(resource.groups[0]!, 0)]}
        className='w-full'
      >
        {resource.groups.map((group, index) => {
          const key = groupKey(group, index);
          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger>
                <span>{group.kind === 'shotPlan' ? group.shotPlan.title : 'Miscellaneous'}</span>
                <span className='ml-auto mr-3 text-xs font-normal tabular-nums text-muted-foreground'>
                  {group.assets.length}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ShotPlanVideoGenerationGroup
                  projectName={projectName}
                  assets={group.assets}
                  onDeleted={retry}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function groupKey(
  group: StudioSceneShotPlanVideoGenerations['groups'][number],
  index: number,
): string {
  return group.kind === 'shotPlan'
    ? `shot-plan:${group.shotPlan.id}`
    : `miscellaneous:${index}`;
}
