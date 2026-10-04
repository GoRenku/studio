import type {
  AssetFileSelectionReport,
  RecoverableMutationReport,
  ShotPlanListReport,
} from '@gorenku/studio-core/client';
import {
  toStudioAssetFileResponse,
  type StudioAssetFileResponse,
} from './asset-responses.js';

export interface StudioShotPlanListItemResponse {
  previsRender: StudioAssetFileResponse | null;
  shotPlan: Omit<
    ShotPlanListReport['shotPlans'][number]['shotPlan'],
    'shots'
  > & {
    shots: Array<
      Omit<ShotPlanListReport['shotPlans'][number]['shotPlan']['shots'][number], 'images'> & {
        images: StudioAssetFileResponse[];
      }
    >;
  };
  coveredBeats: Array<
    Omit<ShotPlanListReport['shotPlans'][number]['coveredBeats'][number], 'storyboardImage'> & {
      storyboardImage:
        | {
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
  AssetFileSelectionReport,
  'valid' | 'warnings' | 'selectedAssetFileId' | 'resourceKeys'
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
  report: AssetFileSelectionReport
): StudioShotSelectionMutationResponse {
  return {
    valid: report.valid,
    warnings: report.warnings,
    selectedAssetFileId: report.selectedAssetFileId,
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
    previsRender: item.previsRender ? toStudioAssetFileResponse(projectName, item.previsRender) : null,
    shotPlan: {
      id: item.shotPlan.id,
      type: item.shotPlan.type,
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
        images: shot.images.map((assetFile) => toStudioAssetFileResponse(projectName, assetFile)),
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
              coveredBeat.storyboardImage.assetFileId
            ),
          }
        : null,
    })),
  };
}

function assetFileUrl(
  projectName: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/asset-files/${encodeURIComponent(assetFileId)}`;
}
