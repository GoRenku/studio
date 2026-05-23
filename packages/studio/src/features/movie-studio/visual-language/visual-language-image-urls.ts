export function inspirationImageUrl(
  projectName: string,
  folderId: string,
  fileName: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration/folders/${encodeURIComponent(folderId)}/images/${encodeURIComponent(fileName)}`;
}

export function lookbookImageFileUrl(
  projectName: string,
  imageId: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/images/${encodeURIComponent(imageId)}/files/${encodeURIComponent(assetFileId)}`;
}
