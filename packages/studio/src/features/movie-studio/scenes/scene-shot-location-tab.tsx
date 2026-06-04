import type {
  SceneShot,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { locationAssetFileUrl } from '@/services/studio-project-assets-api';
import { updateShotLocationReference } from '@/services/studio-shot-video-takes-api';
import { DesignSection } from './scene-shot-design-controls';
import { previewImageUrl } from './scene-shot-reference-card-images';
import {
  SceneShotReferenceCardGrid,
  type ShotReferenceCardChoice,
} from './scene-shot-reference-card-grid';

interface SceneShotLocationTabProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  onResourceRefreshed?: (resource: SceneShotListResourceResponse) => void;
  onPlanRefresh?: () => Promise<void>;
}

export function SceneShotLocationTab({
  projectName,
  sceneId,
  shot,
  productionPlan,
  onResourceRefreshed,
  onPlanRefresh,
}: SceneShotLocationTabProps) {
  const selectedLocation =
    productionPlan?.locationReferences.find((choice) => choice.selected) ?? null;
  const locationChoices: ShotReferenceCardChoice[] =
    productionPlan?.locationReferences.map((choice) => {
      const preview = choice.environmentSheet.previews[0];
      const imageUrl = preview
        ? locationAssetFileUrl(
            projectName,
            choice.locationId,
            preview.assetId,
            preview.assetFileId
          )
        : null;
      return {
        id: choice.locationId,
        title: choice.name,
        selected: choice.selected,
        card: choice.environmentSheet,
        imageUrl,
        previewImages: previewImageUrl(preview, imageUrl),
        onSelect: async () => {
          const result = await updateShotLocationReference(
            projectName,
            sceneId,
            shot.shotId,
            { locationId: choice.locationId }
          );
          onResourceRefreshed?.(result.resource);
          await onPlanRefresh?.();
        },
      };
    }) ?? [];
  const viewChoices: ShotReferenceCardChoice[] =
    selectedLocation?.viewChoices.map((choice) => {
      const preview = choice.preview;
      const imageUrl =
        preview && selectedLocation
          ? locationAssetFileUrl(
              projectName,
              selectedLocation.locationId,
              preview.assetId,
              preview.assetFileId
            )
          : null;
      return {
        id: choice.viewId,
        title: choice.label,
        selected: choice.selected,
        card: {
          state: preview ? 'available' : 'unavailable',
          mediaKind: 'image',
          pricing: { state: 'not-applicable', estimatedUsd: null },
          previews: preview ? [preview] : [],
          diagnostics: [],
        },
        imageUrl,
        previewImages: previewImageUrl(preview ?? undefined, imageUrl),
        onSelect: async () => {
          if (!selectedLocation) {
            return;
          }
          const result = await updateShotLocationReference(
            projectName,
            sceneId,
            shot.shotId,
            {
              locationId: selectedLocation.locationId,
              azimuthView: choice.viewId,
            }
          );
          onResourceRefreshed?.(result.resource);
          await onPlanRefresh?.();
        },
      };
    }) ?? [];

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='Shot Location'>
        <SceneShotReferenceCardGrid choices={locationChoices} />
      </DesignSection>
      <DesignSection title='Environment Sheet Views'>
        <SceneShotReferenceCardGrid
          choices={viewChoices}
          columnsClassName='grid-cols-[repeat(auto-fill,minmax(140px,1fr))]'
        />
      </DesignSection>
    </div>
  );
}
