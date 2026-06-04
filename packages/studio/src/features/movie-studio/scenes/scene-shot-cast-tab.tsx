import type {
  SceneShot,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import { castAssetFileUrl } from '@/services/studio-project-assets-api';
import { updateShotCastReferences } from '@/services/studio-shot-video-takes-api';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { DesignSection } from './scene-shot-design-controls';
import { previewImageUrl } from './scene-shot-reference-card-images';
import {
  SceneShotReferenceCardGrid,
  type ShotReferenceCardChoice,
} from './scene-shot-reference-card-grid';

interface SceneShotCastTabProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  onResourceRefreshed?: (resource: SceneShotListResourceResponse) => void;
  onPlanRefresh?: () => Promise<void>;
}

export function SceneShotCastTab({
  projectName,
  sceneId,
  shot,
  productionPlan,
  onResourceRefreshed,
  onPlanRefresh,
}: SceneShotCastTabProps) {
  const selectedIds =
    productionPlan?.castReferences
      .filter((choice) => choice.selected)
      .map((choice) => choice.castMemberId) ?? [];
  const choices: ShotReferenceCardChoice[] =
    productionPlan?.castReferences.map((choice) => {
      const preview = choice.characterSheet.previews[0];
      const imageUrl = preview
        ? castAssetFileUrl(
            projectName,
            choice.castMemberId,
            preview.assetId,
            preview.assetFileId
          )
        : null;
      return {
        id: choice.castMemberId,
        title: choice.name,
        selected: choice.selected,
        card: choice.characterSheet,
        imageUrl,
        previewImages: previewImageUrl(preview, imageUrl),
        onSelect: async () => {
          const nextIds = choice.selected
            ? selectedIds.filter((castMemberId) => castMemberId !== choice.castMemberId)
            : [...selectedIds, choice.castMemberId];
          const result = await updateShotCastReferences(
            projectName,
            sceneId,
            shot.shotId,
            nextIds
          );
          onResourceRefreshed?.(result.resource);
          await onPlanRefresh?.();
        },
      };
    }) ?? [];

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='Cast Members'>
        <SceneShotReferenceCardGrid choices={choices} />
      </DesignSection>
    </div>
  );
}
