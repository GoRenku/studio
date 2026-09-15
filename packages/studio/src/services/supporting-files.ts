import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import type {
  ProjectSupportingFileInformation, ProjectSupportingFilePage, RecoverableMutationReport,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';
import { uploadFileBatch } from './file-uploads';

export interface SupportingFileInformationResponse extends ProjectSupportingFileInformation {
  folderActionLabel: string;
}

export async function readProjectSupportingFiles(projectName: string, cursor?: string | null): Promise<ProjectSupportingFilePage> {
  const search = new URLSearchParams({ limit: '60' });
  if (cursor) search.set('cursor', cursor);
  return readResponse(await studioApiFetch(`${supportingFilesUrl(projectName)}?${search}`));
}

export async function uploadSupportingMaterial(projectName: string, files: File[]): Promise<void> {
  await uploadFileBatch(supportingFilesUrl(projectName), files);
}

export async function readSupportingFileInformation(projectName: string, assetId: string): Promise<SupportingFileInformationResponse> {
  return readResponse(await studioApiFetch(`${supportingFilesUrl(projectName)}/${encodeURIComponent(assetId)}/information`));
}

export async function discardSupportingFile(projectName: string, assetId: string): Promise<RecoverableMutationReport> {
  return readResponse(await studioApiFetch(`${supportingFilesUrl(projectName)}/${encodeURIComponent(assetId)}`, {
    method: 'DELETE', headers: mutationHeaders(),
  }));
}

export async function openSupportingFileFolder(projectName: string, assetId: string): Promise<void> {
  await readResponse(await studioApiFetch(`${supportingFilesUrl(projectName)}/${encodeURIComponent(assetId)}/open-folder`, {
    method: 'POST', headers: mutationHeaders(),
  }));
}

export function openSupportingFileTab(projectName: string, assetId: string): void {
  window.open(`${supportingFilesUrl(projectName)}/${encodeURIComponent(assetId)}/content`, '_blank', 'noopener,noreferrer');
}

function supportingFilesUrl(projectName: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/supporting-files`;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await readStudioApiError(response);
  return response.json() as Promise<T>;
}

function mutationHeaders(): Record<string, string> {
  const token = readStudioApiToken();
  return { 'X-Renku-Studio-Token': token };
}
