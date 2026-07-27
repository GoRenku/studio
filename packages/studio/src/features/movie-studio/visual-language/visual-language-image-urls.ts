export function inspirationImageUrl(
  projectName: string,
  folderId: string,
  fileName: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration/folders/${encodeURIComponent(folderId)}/images/${encodeURIComponent(fileName)}`;
}

export function lookbookImageFileUrl(
  projectName: string,
  assetId: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}

export function lookbookSheetFileUrl(
  projectName: string,
  assetId: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}
