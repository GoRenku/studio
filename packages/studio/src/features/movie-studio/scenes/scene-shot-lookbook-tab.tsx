import type {
  SceneShot,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { updateShotLookbookReference } from '@/services/studio-shot-video-takes-api';
import { lookbookSheetFileUrl } from '../visual-language/visual-language-image-urls';
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
  const selectedLookbookSheetId =
    shot.shotSpecs?.lookbookReference?.lookbookSheetId ?? null;
  const choices: ShotReferenceCardChoice[] =
    productionPlan?.lookbookReferences.map((choice) => {
      const preview = choice.image.previews[0];
      const imageUrl =
        preview && choice.lookbookSheetId
          ? lookbookSheetFileUrl(projectName, choice.lookbookSheetId, preview.assetFileId)
          : null;
      return {
        id: choice.lookbookSheetId ?? choice.lookbookId,
        title: choice.title,
        selected: choice.lookbookSheetId === selectedLookbookSheetId,
        card: choice.image,
        imageUrl,
        previewImages: previewImageUrl(preview, imageUrl),
        onSelect: async () => {
          const result = await updateShotLookbookReference(
            projectName,
            sceneId,
            shot.shotId,
            choice.lookbookSheetId
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
