import type {
  Asset,
  AssetFile,
  ShotPlanListReport,
} from '@gorenku/studio-core/server';

export interface StudioAssetFileResponse
  extends Omit<AssetFile, 'projectRelativePath'> {
  url: string;
}

export interface StudioAssetResponse extends Omit<Asset, 'files'> {
  files: StudioAssetFileResponse[];
}

export interface StudioShotPlanListItemResponse {
  shotPlan: Omit<ShotPlanListReport['shotPlans'][number]['shotPlan'], 'shots'> & {
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

export function toStudioShotAssetResponse(
  projectName: string,
  asset: Asset
): StudioAssetResponse {
  return {
    ...asset,
    files: asset.files.map((file) => ({
      id: file.id,
      role: file.role,
      mediaKind: file.mediaKind,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      contentHash: file.contentHash,
      width: file.width,
      height: file.height,
      durationSeconds: file.durationSeconds,
      url: assetFileUrl(projectName, asset.id, file.id),
    })),
  };
}

function toStudioShotPlanListItemResponse(
  projectName: string,
  item: ShotPlanListReport['shotPlans'][number]
): StudioShotPlanListItemResponse {
  return {
    shotPlan: {
      ...item.shotPlan,
      shots: item.shotPlan.shots.map((shot) => ({
        ...shot,
        images: shot.images.map((asset) => ({
          ...asset,
          files:
            asset.id === shot.selectedImageId
              ? toStudioShotAssetResponse(projectName, asset).files
              : [],
        })),
      })),
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
