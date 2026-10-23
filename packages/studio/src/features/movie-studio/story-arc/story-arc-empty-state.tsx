import { FileText } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import {
  analyzeScreenplayRequest,
  importScreenplayRequest,
  writeSceneRequest,
} from '../agent-request-copy';
import { StoryArcPreview } from './story-arc-preview';

/** The Screenplay Analysis page before an analysis exists. */
export function StoryArcEmptyState({ sceneCount }: { sceneCount: number }) {
  const frame = 'min-h-[520px] rounded-(--radius-panel) border border-border/60';
  if (sceneCount === 0) {
    return (
      <PanelEmptyState
        className={frame}
        icon={FileText}
        title='No screenplay to analyze yet'
        description='Bring in a Final Draft screenplay, or have your agent write one with you.'
        request={importScreenplayRequest}
        moreRequests={[writeSceneRequest]}
      />
    );
  }
  return (
    <PanelEmptyState
      className={frame}
      preview={<StoryArcPreview sceneCount={sceneCount} />}
      title='See the shape of your story'
      description='Your agent reads every scene, marks the acts and turning points, and writes an arc for each main character.'
      request={analyzeScreenplayRequest}
    />
  );
}
