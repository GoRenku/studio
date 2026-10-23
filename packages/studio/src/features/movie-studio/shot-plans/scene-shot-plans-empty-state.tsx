import { Camera } from 'lucide-react';
import { Button } from '@/ui/button';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { StepChain } from '@/ui/step-chain';
import {
  blenderPrevisRequest,
  sceneBeatsThenShotsRequest,
  sceneShotsRequest,
} from '../agent-request-copy';
import { useSceneHasBeats } from '../scenes/use-scene-has-beats';

/** The Shot Plans tab before any plan exists; names the beats first when the scene has none. */
export function SceneShotPlansEmptyState({
  projectName,
  sceneId,
  sceneHeading,
}: {
  projectName: string;
  sceneId: string;
  sceneHeading: string;
}) {
  const { hasBeats, error, retry } = useSceneHasBeats(projectName, sceneId);
  if (error) {
    return (
      <div className='flex h-full flex-col items-start justify-center gap-3 p-8'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button type='button' variant='outline' size='sm' onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }
  if (hasBeats === null) {
    return <p className='p-8 text-sm text-muted-foreground'>Loading Scene Beats...</p>;
  }
  if (!hasBeats) {
    return (
      <PanelEmptyState
        prerequisite={
          <StepChain
            steps={[
              { label: 'Beats', note: 'not yet', state: 'missing' },
              { label: 'Shot plan', note: 'this tab', state: 'upcoming' },
              { label: 'Video takes', note: 'Generations', state: 'upcoming' },
            ]}
          />
        }
        title='Shot plans start from beats'
        description='This scene has no beats yet. Your agent can write them and plan the shots in one go.'
        request={sceneBeatsThenShotsRequest(sceneHeading)}
        moreRequests={[blenderPrevisRequest]}
      />
    );
  }
  return (
    <PanelEmptyState
      icon={Camera}
      title='No shot plans yet'
      description='A shot plan lists the camera coverage for this scene, beat by beat.'
      request={sceneShotsRequest(sceneHeading)}
      moreRequests={[blenderPrevisRequest]}
    />
  );
}
