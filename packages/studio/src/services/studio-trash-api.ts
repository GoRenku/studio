import type {
  GarbageCollectionPreview,
  GarbageCollectionReport,
  RecoverableMutationReport,
  TrashListReport,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export async function listTrash(projectName: string): Promise<TrashListReport> {
  const body = await readJson<TrashApiResponse<TrashListReport>>(
    trashPath(projectName)
  );
  return body.report;
}

export async function restoreTrashItem(
  projectName: string,
  trashItemId: string
): Promise<RecoverableMutationReport> {
  const body = await writeJson<TrashApiResponse<RecoverableMutationReport>>(
    `${trashPath(projectName)}/restore`,
    { trashItemId }
  );
  return body.report;
}

export async function previewEmptyTrash(
  projectName: string
): Promise<GarbageCollectionPreview> {
  const body = await writeJson<TrashApiResponse<GarbageCollectionPreview>>(
    `${trashPath(projectName)}/empty/preview`,
    {}
  );
  return body.report;
}

export async function runEmptyTrash(
  projectName: string,
  confirmationToken: string
): Promise<GarbageCollectionReport> {
  const body = await writeJson<TrashApiResponse<GarbageCollectionReport>>(
    `${trashPath(projectName)}/empty/run`,
    { confirmationToken }
  );
  return body.report;
}

interface TrashApiResponse<T> {
  report: T;
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as T;
}

async function writeJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as T;
}

function jsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Renku-Studio-Token': readStudioApiToken(),
  };
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}

function trashPath(projectName: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/trash`;
}
