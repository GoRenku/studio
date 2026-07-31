import type {
  CastMemberResourceResponse,
  CastOverviewResourceResponse,
  LocationOverviewResourceResponse,
  LocationResourceResponse,
  PropOverviewResourceResponse,
  PropResourceResponse,
} from './studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

interface ResourceResponse<T> {
  resource: T | null;
}

interface PageQuery {
  limit?: number;
  cursor?: string | null;
}

export async function readCastOverviewResource(
  projectName: string,
  query: PageQuery = {}
): Promise<CastOverviewResourceResponse> {
  return readResource(continuityPath(projectName, '/cast'), query);
}

export async function readCastMemberResource(
  projectName: string,
  castMemberId: string
): Promise<CastMemberResourceResponse> {
  return readResource(
    continuityPath(projectName, `/cast/${encodeURIComponent(castMemberId)}`)
  );
}

export async function updateCastMemberVoiceOverStatus(
  projectName: string,
  castMemberId: string,
  isVoiceOver: boolean
): Promise<CastMemberResourceResponse> {
  const response = await fetch(
    continuityPath(
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
    throw new Error('Renku Studio API returned no continuity resource.');
  }
  return body.resource;
}

export async function readLocationOverviewResource(
  projectName: string,
  query: PageQuery = {}
): Promise<LocationOverviewResourceResponse> {
  return readResource(continuityPath(projectName, '/locations'), query);
}

export async function readLocationResource(
  projectName: string,
  locationId: string
): Promise<LocationResourceResponse> {
  return readResource(
    continuityPath(projectName, `/locations/${encodeURIComponent(locationId)}`)
  );
}

export async function readPropOverviewResource(
  projectName: string,
  query: PageQuery = {}
): Promise<PropOverviewResourceResponse> {
  return readResource(continuityPath(projectName, '/props'), query);
}

export async function readPropResource(
  projectName: string,
  propId: string
): Promise<PropResourceResponse> {
  return readResource(
    continuityPath(projectName, `/props/${encodeURIComponent(propId)}`)
  );
}

async function readResource<T>(path: string, query: PageQuery = {}): Promise<T> {
  const response = await fetch(`${path}${queryString(query)}`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ResourceResponse<T>;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no continuity resource.');
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

function continuityPath(projectName: string, path: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/continuity${path}`;
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
