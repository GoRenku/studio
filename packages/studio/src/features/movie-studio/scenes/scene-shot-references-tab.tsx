import type { ShotVideoTakeProductionPlanReport } from '@gorenku/studio-core/client';
import { sceneAssetFileUrl } from '@/services/studio-project-assets-api';
import { DesignSection } from './scene-shot-design-controls';
import { previewImageUrl } from './scene-shot-reference-card-images';
import {
  SceneShotReferenceCardGrid,
  type ShotReferenceCardChoice,
} from './scene-shot-reference-card-grid';

interface SceneShotReferencesTabProps {
  projectName: string;
  sceneId: string;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
}

export function SceneShotReferencesTab({
  projectName,
  sceneId,
  productionPlan,
}: SceneShotReferencesTabProps) {
  const choices: ShotReferenceCardChoice[] =
    productionPlan?.imageReferences.map((choice) => {
      const preview = choice.image.previews[0];
      const imageUrl = preview
        ? sceneAssetFileUrl(projectName, sceneId, preview.assetId, preview.assetFileId)
        : null;
      return {
        id: `${choice.referenceKind}:${choice.title}`,
        title: choice.title,
        selected: choice.selected,
        card: choice.image,
        imageUrl,
        previewImages: previewImageUrl(preview, imageUrl),
      };
    }) ?? [];

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='Reference Images'>
        <SceneShotReferenceCardGrid choices={choices} />
      </DesignSection>
    </div>
  );
}
