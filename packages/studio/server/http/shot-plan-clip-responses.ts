import type { ShotPlanClips } from '@gorenku/studio-core/client';
import { toStudioAssetFileResponse } from './asset-responses.js';

export function toStudioClipResponse(projectName: string, report: ShotPlanClips) {
  return {
    ...report,
    assetFiles: report.assetFiles.map((assetFile) => toStudioAssetFileResponse(projectName, assetFile)),
    unassignedAssetFiles: report.unassignedAssetFiles.map((assetFile) => toStudioAssetFileResponse(projectName, assetFile)),
  };
}
