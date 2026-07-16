import type {
  StudioSelectionContextRequest,
  StudioSelectionContextResponse,
  SceneNavigationPageResponse,
  SequenceNavigationPageResponse,
  ProjectInformationResourceResponse,
  ProjectInformationUpdateRequest,
  ProjectLibraryWithHttp,
  ProjectShellWithHttp,
} from '@/services/studio-project-contracts';
import './studio-current-contracts';
import { readStudioApiError } from './studio-api-errors';

interface ProjectResponse {
  project: ProjectShellWithHttp | null;
}

interface ProjectInformationResourceApiResponse {
  resource: ProjectInformationResourceResponse | null;
}

interface NavigationPageApiResponse<T> {
  page: T;
}

interface NavigationPageQuery {
  limit?: number;
  cursor?: string | null;
}

interface LibraryResponse {
  library: ProjectLibraryWithHttp;
}

export async function readProject(projectName: string): Promise<ProjectShellWithHttp> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ProjectResponse;
  if (!body.project) {
    throw new Error('Renku Studio API returned no project.');
  }
  return body.project;
}

export async function readProjectLibrary(): Promise<ProjectLibraryWithHttp> {
  const response = await fetch('/studio-api/projects');
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as LibraryResponse;
  return body.library;
}

export async function readStudioSelectionContext(
  projectName: string,
  request: StudioSelectionContextRequest
): Promise<StudioSelectionContextResponse> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/movie-studio-selection/context`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as StudioSelectionContextResponse;
}

export async function readSequenceNavigation(
  projectName: string,
  query: NavigationPageQuery = {}
): Promise<SequenceNavigationPageResponse> {
  return readNavigationPage(
    `/studio-api/projects/${encodeURIComponent(projectName)}/sequences`,
    query
  );
}

export async function readSceneNavigation(
  projectName: string,
  sequenceId: string,
  query: NavigationPageQuery = {}
): Promise<SceneNavigationPageResponse> {
  return readNavigationPage(
    `/studio-api/projects/${encodeURIComponent(projectName)}/sequences/${encodeURIComponent(
      sequenceId
    )}/scenes`,
    query
  );
}

export async function readProjectInformationResource(
  projectName: string
): Promise<ProjectInformationResourceResponse> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/information`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ProjectInformationResourceApiResponse;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no project information resource.');
  }
  return body.resource;
}

export async function updateProjectInformation(
  projectName: string,
  information: ProjectInformationUpdateRequest
): Promise<ProjectInformationResourceResponse> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/information`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify(information),
    }
  );

  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as ProjectInformationResourceApiResponse;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no project information resource.');
  }
  return body.resource;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}

async function readNavigationPage<T>(
  path: string,
  query: NavigationPageQuery
): Promise<T> {
  const response = await fetch(`${path}${navigationQueryString(query)}`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as NavigationPageApiResponse<T>;
  if (!body.page) {
    throw new Error('Renku Studio API returned no navigation page.');
  }
  return body.page;
}

function navigationQueryString(query: NavigationPageQuery): string {
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
