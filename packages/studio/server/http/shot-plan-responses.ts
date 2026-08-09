import type {
  AssetSelectionReport,
  RecoverableMutationReport,
  ShotPlanListReport,
} from '@gorenku/studio-core/client';
import {
  toStudioAssetResponse,
  type StudioAssetResponse,
} from './asset-responses.js';

export interface StudioShotPlanListItemResponse {
  shotPlan: Omit<
    ShotPlanListReport['shotPlans'][number]['shotPlan'],
    'shots'
  > & {
    shots: Array<
      Omit<ShotPlanListReport['shotPlans'][number]['shotPlan']['shots'][number], 'images'> & {
        images: StudioAssetResponse[];
      }
    >;
  };
  coveredBeats: Array<
    Omit<ShotPlanListReport['shotPlans'][number]['coveredBeats'][number], 'storyboardImage'> & {
      storyboardImage:
        | {
            assetId: string;
            assetFileId: string;
            url: string;
          }
        | null;
    }
  >;
}

export interface StudioShotPlansResponse {
  sceneId: string;
  shotPlans: StudioShotPlanListItemResponse[];
  warnings: ShotPlanListReport['warnings'];
}

export type StudioShotSelectionMutationResponse = Pick<
  AssetSelectionReport,
  'valid' | 'warnings' | 'selectedAssetId' | 'resourceKeys'
>;

export type StudioRecoverableMutationResponse = Pick<
  RecoverableMutationReport,
  'valid' | 'warnings' | 'changes' | 'recovery' | 'resourceKeys'
>;

export function toStudioShotPlansResponse(
  projectName: string,
  sceneId: string,
  report: ShotPlanListReport
): StudioShotPlansResponse {
  return {
    sceneId,
    shotPlans: report.shotPlans.map((item) =>
      toStudioShotPlanListItemResponse(projectName, item)
    ),
    warnings: report.warnings,
  };
}

export function toStudioShotSelectionMutationResponse(
  report: AssetSelectionReport
): StudioShotSelectionMutationResponse {
  return {
    valid: report.valid,
    warnings: report.warnings,
    selectedAssetId: report.selectedAssetId,
    resourceKeys: report.resourceKeys,
  };
}

export function toStudioRecoverableMutationResponse(
  report: RecoverableMutationReport
): StudioRecoverableMutationResponse {
  return {
    valid: report.valid,
    warnings: report.warnings,
    changes: report.changes,
    recovery: report.recovery,
    resourceKeys: report.resourceKeys,
  };
}

function toStudioShotPlanListItemResponse(
  projectName: string,
  item: ShotPlanListReport['shotPlans'][number]
): StudioShotPlanListItemResponse {
  return {
    shotPlan: {
      id: item.shotPlan.id,
      number: item.shotPlan.number,
      sceneId: item.shotPlan.sceneId,
      title: item.shotPlan.title,
      coverage: item.shotPlan.coverage,
      shots: item.shotPlan.shots.map((shot) => ({
        id: shot.id,
        number: shot.number,
        position: shot.position,
        title: shot.title,
        description: shot.description,
        brief: shot.brief,
        images: shot.images.map((asset) => ({
          ...asset,
          files:
            asset.id === shot.selectedImageId
              ? toStudioAssetResponse(projectName, asset).files
              : [],
        })),
        selectedImageId: shot.selectedImageId,
      })),
      createdAt: item.shotPlan.createdAt,
      updatedAt: item.shotPlan.updatedAt,
    },
    coveredBeats: item.coveredBeats.map((coveredBeat) => ({
      ...coveredBeat,
      storyboardImage: coveredBeat.storyboardImage
        ? {
            ...coveredBeat.storyboardImage,
            url: assetFileUrl(
              projectName,
              coveredBeat.storyboardImage.assetId,
              coveredBeat.storyboardImage.assetFileId
            ),
          }
        : null,
    })),
  };
}

function assetFileUrl(
  projectName: string,
  assetId: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}
