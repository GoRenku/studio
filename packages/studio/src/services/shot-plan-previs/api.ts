import { readStudioApiToken, studioApiFetch } from '../studio-api-fetch';
import { readStudioApiError } from '../studio-api-errors';
import type { StudioShotPlanPrevis } from './contracts';

export async function readStudioShotPlanPrevis(input: {
  projectName: string;
  shotPlanId: string;
  signal?: AbortSignal;
}): Promise<StudioShotPlanPrevis> {
  const response = await studioApiFetch(`/studio-api/projects/${encodeURIComponent(input.projectName)}/screenplay/shot-plans/${encodeURIComponent(input.shotPlanId)}/previs`, { signal: input.signal });
  if (!response.ok) throw await readStudioApiError(response);
  return response.json();
}

export async function selectStudioClipTake(input: { projectName: string; clipId: string; takeId: string | null }) {
  const response = await studioApiFetch(`/studio-api/projects/${encodeURIComponent(input.projectName)}/screenplay/clips/${encodeURIComponent(input.clipId)}/selection`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Renku-Studio-Token': readStudioApiToken() },
    body: JSON.stringify({ takeId: input.takeId }),
  });
  if (!response.ok) throw await readStudioApiError(response);
  return response.json();
}
