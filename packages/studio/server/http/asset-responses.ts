import type { AssetFile } from '@gorenku/studio-core/client';

export interface StudioAssetFileResponse
  extends Omit<AssetFile, 'projectRelativePath'> {
  url: string;
}

export function toStudioAssetFileResponse(
  projectName: string,
  assetFile: AssetFile
): StudioAssetFileResponse {
  const { projectRelativePath: _projectRelativePath, ...metadata } = assetFile;
  return {
    ...metadata,
    url: assetFileUrl(projectName, assetFile.id),
  };
}

function assetFileUrl(
  projectName: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/asset-files/${encodeURIComponent(assetFileId)}`;
}
