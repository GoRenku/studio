import type {
  SceneBeatsResourceResponse,
  ScreenplaySceneResourceResponse,
} from '@/services/studio-project-contracts';
import { readStudioApiError } from '@/services/studio-api-errors';

export async function readScreenplayScene(
  projectName: string,
  sceneId: string
): Promise<ScreenplaySceneResourceResponse> {
  return readResource(screenplayPath(projectName, `/scenes/${encodeURIComponent(sceneId)}`));
}

export async function readSceneBeatsResource(
  projectName: string,
  sceneId: string
): Promise<SceneBeatsResourceResponse> {
  return readResource(
    screenplayPath(projectName, `/scenes/${encodeURIComponent(sceneId)}/beats`)
  );
}

async function readResource<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { resource: T | null };
  if (!body.resource) {
    throw new Error('Renku Studio API returned no screenplay resource.');
  }
  return body.resource;
}

function screenplayPath(projectName: string, path: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay${path}`;
}
