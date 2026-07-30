import type { StudioSceneShotPlanVideoGenerations } from './studio-shot-plan-video-generations-contracts';
import { readStudioApiError } from './studio-api-errors';

export async function readSceneShotPlanVideoGenerations(
  projectName: string,
  sceneId: string,
): Promise<StudioSceneShotPlanVideoGenerations> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/video-generations`,
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = await response.json() as {
    resource: StudioSceneShotPlanVideoGenerations;
  };
  return body.resource;
}

export async function deleteProjectVideoAsset(
  projectName: string,
  assetId: string,
): Promise<void> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/project-assets/${encodeURIComponent(assetId)}`,
    {
      method: 'DELETE',
      headers: {
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
    },
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  await response.json();
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
