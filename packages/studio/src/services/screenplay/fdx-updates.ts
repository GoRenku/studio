import { readStudioApiToken, studioApiFetch } from '../studio-api-fetch';
import type { FdxUpdateStatus, FdxUpdateReview } from '@gorenku/studio-core/client';
import { readStudioApiError } from '../studio-api-errors';

export async function readFdxUpdateStatus(projectName: string, signal?: AbortSignal): Promise<{
  status: FdxUpdateStatus; folderActionLabel: string;
}> {
  return request(projectName, '', { signal, cache: 'no-store' });
}

export async function reviewFdxUpdate(projectName: string, sourceSha256: string, signal?: AbortSignal): Promise<FdxUpdateReview> {
  return request(projectName, '/review', { ...mutation({ sourceSha256 }), signal });
}

export async function applyFdxUpdate(projectName: string, reviewFingerprint: string): Promise<{ resourceKeys: string[] }> {
  return request(projectName, '/apply', mutation({ reviewFingerprint }));
}

export async function openFdxExportFolder(projectName: string): Promise<void> {
  await request(projectName, '/open-folder', mutation({}));
}

function mutation(body: object): RequestInit {
  const token = readStudioApiToken();
  return { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Renku-Studio-Token': token }, body: JSON.stringify(body) };
}

async function request<T>(projectName: string, suffix: string, init: RequestInit): Promise<T> {
  const response = await studioApiFetch(`/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/fdx-update${suffix}`, init);
  if (!response.ok) throw await readStudioApiError(response);
  return response.json() as Promise<T>;
}
