import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import { readStudioApiError } from './studio-api-errors';
import type {
  StudioRecoverableMutationResponse,
  StudioShotImageCandidateCollection,
  StudioShotImageCandidatePage,
  StudioShotPlansResponse,
  StudioShotPlanAssetFiles,
  StudioShotSelectionMutationResponse,
} from './studio-shot-plans-contracts';

export async function listStudioSceneShotPlans(input: {
  projectName: string;
  sceneId: string;
  signal?: AbortSignal;
}): Promise<StudioShotPlansResponse> {
  return readJson<StudioShotPlansResponse>(
    `/studio-api/projects/${encodeURIComponent(input.projectName)}/screenplay/scenes/${encodeURIComponent(input.sceneId)}/shot-plans`,
    { signal: input.signal }
  );
}

export async function deleteStudioShotPlan(input: {
  projectName: string;
  shotPlanId: string;
}): Promise<StudioRecoverableMutationResponse> {
  return readJson<StudioRecoverableMutationResponse>(
    shotPlanUrl(input.projectName, input.shotPlanId),
    mutationRequest('DELETE')
  );
}

export async function readStudioShotPlanAssetFiles(input: {
  projectName: string;
  shotPlanId: string;
  signal?: AbortSignal;
}): Promise<StudioShotPlanAssetFiles> {
  const body = await readJson<{ resource: StudioShotPlanAssetFiles }>(
    `${shotPlanUrl(input.projectName, input.shotPlanId)}/asset-files`,
    { signal: input.signal },
  );
  return body.resource;
}

export async function deleteStudioShotPlanAssetFile(input: {
  projectName: string;
  shotPlanId: string;
  assetFileId: string;
}): Promise<StudioRecoverableMutationResponse> {
  return readJson<StudioRecoverableMutationResponse>(
    `${shotPlanUrl(input.projectName, input.shotPlanId)}/asset-files/${encodeURIComponent(input.assetFileId)}`,
    mutationRequest('DELETE'),
  );
}

export async function listStudioShotImageCandidates(input: {
  projectName: string;
  shotId: string;
  signal?: AbortSignal;
}): Promise<StudioShotImageCandidateCollection> {
  const items: StudioShotImageCandidateCollection['items'] = [];
  let selectedAssetFileId: string | null = null;
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({
      ownerKind: 'shot',
      ownerId: input.shotId,
      type: 'shot_image',
      mediaKind: 'image',
      limit: '200',
    });
    if (cursor) {
      query.set('cursor', cursor);
    }
    const body = await readJson<{ page: StudioShotImageCandidatePage }>(
      `/studio-api/projects/${encodeURIComponent(input.projectName)}/asset-files?${query.toString()}`,
      { signal: input.signal }
    );
    items.push(...body.page.items);
    selectedAssetFileId = body.page.selectedAssetFileId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items, selectedAssetFileId };
}

export async function setStudioShotSelectedImage(input: {
  projectName: string;
  shotId: string;
  assetFileId: string;
}): Promise<StudioShotSelectionMutationResponse> {
  return readJson<StudioShotSelectionMutationResponse>(
    `${shotsUrl(input.projectName)}/${encodeURIComponent(input.shotId)}/selected-image/${encodeURIComponent(input.assetFileId)}`,
    mutationRequest('POST')
  );
}

export async function deleteStudioShotImageCandidate(input: {
  projectName: string;
  shotId: string;
  assetFileId: string;
}): Promise<StudioRecoverableMutationResponse> {
  return readJson<StudioRecoverableMutationResponse>(
    `${shotsUrl(input.projectName)}/${encodeURIComponent(input.shotId)}/images/${encodeURIComponent(input.assetFileId)}`,
    mutationRequest('DELETE')
  );
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await studioApiFetch(url, init);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as T;
}

function shotPlanUrl(projectName: string, shotPlanId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/shot-plans/${encodeURIComponent(shotPlanId)}`;
}

function shotsUrl(projectName: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/shots`;
}

function mutationRequest(method: 'POST' | 'DELETE'): RequestInit {
  return {
    method,
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  };
}
