import { PanelEmptyState } from '@/ui/panel-empty-state';
import { designAllSceneBeatsRequest, sceneBeatsRequest } from '../agent-request-copy';
import { SceneBeatsPreview } from './scene-beats-preview';

export function SceneBeatsEmptyState({ sceneHeading }: { sceneHeading: string }) {
  return (
    <PanelEmptyState
      className='bg-panel-bg'
      preview={<SceneBeatsPreview />}
      title='Break this scene into beats'
      description='Each beat is one moment of the scene, with a storyboard frame you can later plan shots from.'
      request={sceneBeatsRequest(sceneHeading)}
      moreRequests={[designAllSceneBeatsRequest]}
    />
  );
}
