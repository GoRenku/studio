import type { ShotPlanClips } from '@gorenku/studio-core/client';
import { toStudioAssetResponse } from './asset-responses.js';

export function toStudioClipResponse(projectName: string, report: ShotPlanClips) {
  return {
    ...report,
    assets: report.assets.map((asset) => toStudioAssetResponse(projectName, asset)),
    unassignedAssets: report.unassignedAssets.map((asset) => toStudioAssetResponse(projectName, asset)),
  };
}
