import type {
  InspirationFolderResourceResponse,
  InspirationFolderResponse,
  InspirationResourceResponse,
  LookbookImageResponse,
  LookbookResourceResponse,
  LookbookSheetResponse,
  LookbooksResourceResponse,
} from './studio-project-contracts';
import type { LookbookType } from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

interface InspirationResourceApiResponse {
  resource: InspirationResourceResponse;
}

interface InspirationFolderResourceApiResponse {
  resource: InspirationFolderResourceResponse;
  resourceKeys?: string[];
}

interface InspirationFolderApiResponse {
  folder: InspirationFolderResponse;
  resourceKeys?: string[];
}

interface LookbooksResourceApiResponse {
  resource: LookbooksResourceResponse;
}

interface LookbookResourceApiResponse {
  resource: LookbookResourceResponse;
}

interface LookbookImageApiResponse {
  image: LookbookImageResponse;
  resourceKeys?: string[];
}

interface LookbookSheetApiResponse {
  sheet: LookbookSheetResponse;
  resourceKeys?: string[];
}

export async function readInspirationResource(
  projectName: string
): Promise<InspirationResourceResponse> {
  const body = await readJson<InspirationResourceApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration`
  );
  return body.resource;
}

export async function readInspirationFolder(
  projectName: string,
  folderId: string
): Promise<InspirationFolderResourceResponse> {
  const body = await readJson<InspirationFolderResourceApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration/folders/${encodeURIComponent(folderId)}`
  );
  return body.resource;
}

export async function createInspirationFolder(
  projectName: string,
  name: string
): Promise<InspirationFolderResponse> {
  const body = await writeJson<InspirationFolderApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration/folders`,
    'POST',
    { name }
  );
  return body.folder;
}

export async function deleteInspirationFolder(
  projectName: string,
  folderId: string
): Promise<void> {
  await writeJson(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration/folders/${encodeURIComponent(folderId)}`,
    'DELETE',
    {}
  );
}

export async function uploadInspirationImages(
  projectName: string,
  folderId: string,
  files: File[]
): Promise<InspirationFolderResourceResponse> {
  let resource: InspirationFolderResourceResponse | null = null;
  for (const file of files) {
    const response = await fetch(
      `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration/folders/${encodeURIComponent(folderId)}/images?fileName=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Renku-Studio-Token': readStudioApiToken(),
        },
        body: await file.arrayBuffer(),
      }
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }
    resource = ((await response.json()) as InspirationFolderResourceApiResponse)
      .resource;
  }
  return resource ?? readInspirationFolder(projectName, folderId);
}

export async function deleteInspirationImage(
  projectName: string,
  folderId: string,
  fileName: string
): Promise<InspirationFolderResourceResponse> {
  const body = await writeJson<InspirationFolderResourceApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/inspiration/folders/${encodeURIComponent(folderId)}/images/${encodeURIComponent(fileName)}`,
    'DELETE',
    {}
  );
  return body.resource;
}

export async function listLookbooks(
  projectName: string
): Promise<LookbooksResourceResponse> {
  const body = await readJson<LookbooksResourceApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks`
  );
  return body.resource;
}

export async function readLookbook(
  projectName: string,
  lookbookId: string
): Promise<LookbookResourceResponse> {
  const body = await readJson<LookbookResourceApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/${encodeURIComponent(lookbookId)}`
  );
  return body.resource;
}

export async function selectLookbookForType(
  projectName: string,
  type: LookbookType,
  lookbookId: string
): Promise<void> {
  await writeJson(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/selection/${encodeURIComponent(type)}`,
    'PUT',
    { lookbookId }
  );
}

export async function clearLookbookSelection(
  projectName: string,
  type: LookbookType
): Promise<void> {
  await writeJson(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/selection/${encodeURIComponent(type)}`,
    'DELETE',
    {}
  );
}

export async function deleteLookbook(
  projectName: string,
  lookbookId: string
): Promise<void> {
  await writeJson(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/${encodeURIComponent(lookbookId)}`,
    'DELETE',
    {}
  );
}

export async function deleteLookbookImage(
  projectName: string,
  imageId: string
): Promise<void> {
  await writeJson(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/images/${encodeURIComponent(imageId)}`,
    'DELETE',
    {}
  );
}

export async function deleteLookbookSheet(
  projectName: string,
  sheetId: string
): Promise<void> {
  await writeJson(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/sheets/${encodeURIComponent(sheetId)}`,
    'DELETE',
    {}
  );
}

export async function setDefaultLookbookSheet(
  projectName: string,
  sheetId: string
): Promise<LookbookSheetResponse> {
  const body = await writeJson<LookbookSheetApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/sheets/${encodeURIComponent(sheetId)}/default`,
    'PUT',
    {}
  );
  return body.sheet;
}

export async function setLookbookCardImage(
  projectName: string,
  lookbookId: string,
  imageId: string
): Promise<LookbookImageResponse> {
  const body = await writeJson<LookbookImageApiResponse>(
    `/studio-api/projects/${encodeURIComponent(projectName)}/visual-language/lookbooks/${encodeURIComponent(lookbookId)}/card-image`,
    'PUT',
    { imageId }
  );
  return body.image;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as T;
}

async function writeJson<T>(
  url: string,
  method: string,
  body: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as T;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
