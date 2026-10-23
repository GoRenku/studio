import { Film } from 'lucide-react';
import { Button } from '@/ui/button';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { StepChain } from '@/ui/step-chain';
import { sceneShotsThenVideoRequest, sceneVideoTakesRequest } from '../agent-request-copy';
import { useSceneShotPlans } from '../shot-plans/use-scene-shot-plans';

/** The Generations tab before any video exists; names the shot plan first when there is none. */
export function SceneVideoGenerationsEmptyState({
  projectName,
  sceneId,
  sceneHeading,
}: {
  projectName: string;
  sceneId: string;
  sceneHeading: string;
}) {
  const { resource, error, reload } = useSceneShotPlans(projectName, sceneId);
  if (error) {
    return (
      <div className='space-y-3 p-6'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button type='button' variant='outline' onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }
  if (!resource) {
    return <p className='p-6 text-sm text-muted-foreground'>Loading Shot Plans...</p>;
  }
  if (resource.shotPlans.length === 0) {
    return (
      <PanelEmptyState
        prerequisite={
          <StepChain
            steps={[
              { label: 'Shot plan', note: 'not yet', state: 'missing' },
              { label: 'Video takes', note: 'this tab', state: 'upcoming' },
            ]}
          />
        }
        title='Video takes start from a shot plan'
        description='Plan the shots for this scene first. Your agent can do both in one go.'
        request={sceneShotsThenVideoRequest(sceneHeading)}
      />
    );
  }
  return (
    <PanelEmptyState
      icon={Film}
      title='No video takes yet'
      description='Generated videos for this scene’s shot plans appear here, grouped by plan.'
      request={sceneVideoTakesRequest(sceneHeading)}
    />
  );
}
