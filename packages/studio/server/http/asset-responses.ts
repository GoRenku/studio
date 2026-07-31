import type { Asset, AssetFile } from '@gorenku/studio-core/client';

export interface StudioAssetFileResponse
  extends Omit<AssetFile, 'projectRelativePath'> {
  url: string;
}

export interface StudioAssetResponse extends Omit<Asset, 'files'> {
  files: StudioAssetFileResponse[];
}

export function toStudioAssetResponse(
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

function assetFileUrl(
  projectName: string,
  assetId: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}
