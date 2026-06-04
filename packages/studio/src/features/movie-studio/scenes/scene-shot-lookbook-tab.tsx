import type {
  SceneShot,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { updateShotLookbookReference } from '@/services/studio-shot-video-takes-api';
import { lookbookImageFileUrl } from '../visual-language/visual-language-image-urls';
import { DesignSection } from './scene-shot-design-controls';
import { previewImageUrl } from './scene-shot-reference-card-images';
import {
  SceneShotReferenceCardGrid,
  type ShotReferenceCardChoice,
} from './scene-shot-reference-card-grid';

interface SceneShotLookbookTabProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  onResourceRefreshed?: (resource: SceneShotListResourceResponse) => void;
  onPlanRefresh?: () => Promise<void>;
}

export function SceneShotLookbookTab({
  projectName,
  sceneId,
  shot,
  productionPlan,
  onResourceRefreshed,
  onPlanRefresh,
}: SceneShotLookbookTabProps) {
  const choices: ShotReferenceCardChoice[] =
    productionPlan?.lookbookReferences.map((choice) => {
      const preview = choice.image.previews[0];
      const imageUrl =
        preview && choice.lookbookImageId
          ? lookbookImageFileUrl(projectName, choice.lookbookImageId, preview.assetFileId)
          : null;
      return {
        id: choice.lookbookImageId ?? choice.lookbookId,
        title: choice.title,
        selected: choice.selected,
        card: choice.image,
        imageUrl,
        previewImages: previewImageUrl(preview, imageUrl),
        onSelect: async () => {
          const result = await updateShotLookbookReference(
            projectName,
            sceneId,
            shot.shotId,
            choice.lookbookImageId
          );
          onResourceRefreshed?.(result.resource);
          await onPlanRefresh?.();
        },
      };
    }) ?? [];

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='Lookbook Sheets'>
        <SceneShotReferenceCardGrid choices={choices} />
      </DesignSection>
    </div>
  );
}
