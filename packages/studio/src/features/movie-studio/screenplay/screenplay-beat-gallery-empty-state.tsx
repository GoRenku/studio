import { Clapperboard, FileText } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import {
  designAllSceneBeatsWithStoryboardsRequest,
  importScreenplayRequest,
  writeSceneRequest,
} from '../agent-request-copy';

/** The Screenplay page before any storyboard frames exist, with or without a screenplay. */
export function ScreenplayBeatGalleryEmptyState({ hasScenes }: { hasScenes: boolean }) {
  if (hasScenes) {
    return (
      <PanelEmptyState
        icon={Clapperboard}
        title='No storyboards yet'
        description='This page shows a storyboard frame for every beat of every scene once they exist.'
        request={designAllSceneBeatsWithStoryboardsRequest}
      />
    );
  }
  return (
    <PanelEmptyState
      icon={FileText}
      title='No screenplay yet'
      description='Bring in a Final Draft screenplay, or have your agent write one with you.'
      request={importScreenplayRequest}
      moreRequests={[writeSceneRequest]}
    />
  );
}
