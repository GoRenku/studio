import { readStudioApiError } from '../studio-api-errors';
import type { StudioShotPlanPrevis } from './contracts';

export async function readStudioShotPlanPrevis(input: {
  projectName: string;
  shotPlanId: string;
  signal?: AbortSignal;
}): Promise<StudioShotPlanPrevis> {
  const response = await fetch(`/studio-api/projects/${encodeURIComponent(input.projectName)}/screenplay/shot-plans/${encodeURIComponent(input.shotPlanId)}/previs`, { signal: input.signal });
  if (!response.ok) throw await readStudioApiError(response);
  return response.json();
}
