import { readStudioApiError } from './studio-api-errors';
import type {
  StudioSceneStoryboardRecoverableMutationResponse,
  StudioSceneStoryboardSelectionMutationResponse,
  StudioSceneStoryboardStatus,
} from './studio-scene-storyboard-images-contracts';

export async function readStudioSceneStoryboardStatus(input: {
  projectName: string;
  sceneId: string;
  sceneBeatsRevisionId: string;
  signal?: AbortSignal;
}): Promise<StudioSceneStoryboardStatus> {
  const response = await fetch(baseUrl(input), { signal: input.signal });
  if (!response.ok) throw await readStudioApiError(response);
  return ((await response.json()) as { status: StudioSceneStoryboardStatus }).status;
}

export async function selectStudioSceneStoryboardImage(
  input: CandidateInput,
): Promise<StudioSceneStoryboardSelectionMutationResponse> {
  return mutate<StudioSceneStoryboardSelectionMutationResponse>(
    `${beatUrl(input)}/selected-image/${encodeURIComponent(input.assetId)}`,
    'POST',
  );
}

export async function deleteStudioSceneStoryboardImage(
  input: CandidateInput,
): Promise<StudioSceneStoryboardRecoverableMutationResponse> {
  return mutate<StudioSceneStoryboardRecoverableMutationResponse>(
    `${beatUrl(input)}/images/${encodeURIComponent(input.assetId)}`,
    'DELETE',
  );
}

interface CandidateInput {
  projectName: string;
  sceneId: string;
  sceneBeatsRevisionId: string;
  beatId: string;
  assetId: string;
}

function baseUrl(input: Omit<CandidateInput, 'beatId' | 'assetId'>): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/screenplay/scenes/${encodeURIComponent(input.sceneId)}/scene-beats/${encodeURIComponent(input.sceneBeatsRevisionId)}/storyboard-images`;
}

function beatUrl(input: CandidateInput): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/screenplay/scenes/${encodeURIComponent(input.sceneId)}/scene-beats/${encodeURIComponent(input.sceneBeatsRevisionId)}/beats/${encodeURIComponent(input.beatId)}`;
}

async function mutate<T>(url: string, method: 'POST' | 'DELETE'): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'X-Renku-Studio-Token': window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken ?? '' },
  });
  if (!response.ok) throw await readStudioApiError(response);
  return (await response.json()) as T;
}
