import type {
  ActNavigationPageResponse,
  ActStoryboardResourceResponse,
  CastMemberResourceResponse,
  CastOverviewResourceResponse,
  LocationOverviewResourceResponse,
  LocationResourceResponse,
  SceneNarrativeResourceResponse,
  SceneNavigationPageResponse,
  SceneBeatSheetResourceResponse,
  SequenceNavigationPageResponse,
  SequenceResourceResponse,
  StoryArcResourceResponse,
} from './studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';
import { decorateSceneDialogueAudioWorkspace } from './studio-scene-dialogue-audio-api';

interface ResourceResponse<T> {
  resource: T | null;
}

interface PageResponse<T> {
  page: T;
}

interface PageQuery {
  limit?: number;
  cursor?: string | null;
}

export async function readCastOverviewResource(
  projectName: string,
  query: PageQuery = {}
): Promise<CastOverviewResourceResponse> {
  return readResource(screenplayPath(projectName, '/cast'), query);
}

export async function readCastMemberResource(
  projectName: string,
  castMemberId: string
): Promise<CastMemberResourceResponse> {
  return readResource(
    screenplayPath(projectName, `/cast/${encodeURIComponent(castMemberId)}`)
  );
}

export async function updateCastMemberVoiceOverStatus(
  projectName: string,
  castMemberId: string,
  isVoiceOver: boolean
): Promise<CastMemberResourceResponse> {
  const response = await fetch(
    screenplayPath(
      projectName,
      `/cast/${encodeURIComponent(castMemberId)}/voice-over`
    ),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify({ isVoiceOver }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ResourceResponse<CastMemberResourceResponse>;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no screenplay resource.');
  }
  return body.resource;
}

export async function readLocationOverviewResource(
  projectName: string,
  query: PageQuery = {}
): Promise<LocationOverviewResourceResponse> {
  return readResource(screenplayPath(projectName, '/locations'), query);
}

export async function readLocationResource(
  projectName: string,
  locationId: string
): Promise<LocationResourceResponse> {
  return readResource(
    screenplayPath(projectName, `/locations/${encodeURIComponent(locationId)}`)
  );
}

export async function readStoryArcResource(
  projectName: string
): Promise<StoryArcResourceResponse> {
  return readResource(screenplayPath(projectName, '/story-arc'));
}

export async function readActNavigation(
  projectName: string,
  query: PageQuery = {}
): Promise<ActNavigationPageResponse> {
  return readPage(screenplayPath(projectName, '/acts'), query);
}

export async function readSequencesForAct(
  projectName: string,
  actId: string,
  query: PageQuery = {}
): Promise<SequenceNavigationPageResponse> {
  return readPage(
    screenplayPath(projectName, `/acts/${encodeURIComponent(actId)}/sequences`),
    query
  );
}

export async function readSequenceResource(
  projectName: string,
  sequenceId: string,
  query: PageQuery = {}
): Promise<SequenceResourceResponse> {
  return readResource(
    screenplayPath(projectName, `/sequences/${encodeURIComponent(sequenceId)}`),
    query
  );
}

export async function readScenesForSequence(
  projectName: string,
  sequenceId: string,
  query: PageQuery = {}
): Promise<SceneNavigationPageResponse> {
  return readPage(
    screenplayPath(projectName, `/sequences/${encodeURIComponent(sequenceId)}/scenes`),
    query
  );
}

export async function readSceneNarrativeResource(
  projectName: string,
  sceneId: string
): Promise<SceneNarrativeResourceResponse> {
  const resource = await readResource<SceneNarrativeResourceResponse>(
    screenplayPath(projectName, `/scenes/${encodeURIComponent(sceneId)}`)
  );
  return {
    ...resource,
    dialogueAudio: decorateSceneDialogueAudioWorkspace(
      projectName,
      sceneId,
      resource.dialogueAudio
    ),
  };
}

export async function readSceneBeatSheetResource(
  projectName: string,
  sceneId: string
): Promise<SceneBeatSheetResourceResponse> {
  return readResource(
    screenplayPath(projectName, `/scenes/${encodeURIComponent(sceneId)}/beat-sheet`)
  );
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}

export async function readActStoryboardResource(
  projectName: string,
  actId: string
): Promise<ActStoryboardResourceResponse> {
  return readResource(
    screenplayPath(projectName, `/acts/${encodeURIComponent(actId)}/storyboard`)
  );
}

async function readResource<T>(path: string, query: PageQuery = {}): Promise<T> {
  const response = await fetch(`${path}${queryString(query)}`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ResourceResponse<T>;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no screenplay resource.');
  }
  return body.resource;
}

async function readPage<T>(path: string, query: PageQuery): Promise<T> {
  const response = await fetch(`${path}${queryString(query)}`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as PageResponse<T>;
  return body.page;
}

function screenplayPath(projectName: string, path: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay${path}`;
}

function queryString(query: PageQuery): string {
  const search = new URLSearchParams();
  if (query.limit !== undefined) {
    search.set('limit', String(query.limit));
  }
  if (query.cursor) {
    search.set('cursor', query.cursor);
  }
  const value = search.toString();
  return value ? `?${value}` : '';
}
