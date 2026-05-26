import type {
  CastDesignResourceResponse,
  SceneDesignResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

interface CastAssetsResponse {
  assets: StudioAssetResponse[];
  page: {
    items: StudioAssetResponse[];
    nextCursor: string | null;
  };
}

interface CastAssetResponse {
  asset: StudioAssetResponse | null;
  resourceKeys?: string[];
}

interface CastAssetDeleteResponse {
  assetId: string;
  resourceKeys?: string[];
}

interface CastDesignResourceApiResponse {
  resource: CastDesignResourceResponse | null;
}

interface SceneDesignResourceApiResponse {
  resource: SceneDesignResourceResponse | null;
}

export async function readCastAssets(
  projectName: string,
  castMemberId: string
): Promise<StudioAssetResponse[]> {
  const assets: StudioAssetResponse[] = [];
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({ limit: '200' });
    if (cursor) search.set('cursor', cursor);
    const response = await fetch(
      `${castAssetsUrl(projectName, castMemberId)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }

    const body = (await response.json()) as CastAssetsResponse;
    assets.push(...body.page.items);
    cursor = body.page.nextCursor;
  } while (cursor);
  return assets;
}

export async function readCastDesignResource(
  projectName: string,
  castMemberId: string,
  role = 'character_sheet'
): Promise<CastDesignResourceResponse> {
  const response = await fetch(
    `${castDesignResourceUrl(projectName, castMemberId)}?role=${encodeURIComponent(role)}`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as CastDesignResourceApiResponse;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no cast design resource.');
  }
  return body.resource;
}

export function invalidateCastDesignResource(
  projectName: string,
  castMemberId: string
): void {
  void projectName;
  void castMemberId;
}

export async function readSceneDesignResource(
  projectName: string,
  sceneId: string,
  role?: string
): Promise<SceneDesignResourceResponse> {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/scenes/${encodeURIComponent(sceneId)}/design${query}`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as SceneDesignResourceApiResponse;
  if (!body.resource) {
    throw new Error('Renku Studio API returned no scene design resource.');
  }
  return body.resource;
}

export async function selectCastAsset(
  projectName: string,
  castMemberId: string,
  assetId: string
): Promise<StudioAssetResponse> {
  const response = await fetch(
    castAssetSelectUrl(projectName, castMemberId, assetId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify({}),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as CastAssetResponse;
  if (!body.asset) {
    throw new Error('Renku Studio API returned no cast asset.');
  }
  return body.asset;
}

export async function unselectCastAsset(
  projectName: string,
  castMemberId: string,
  assetId: string
): Promise<StudioAssetResponse> {
  const response = await fetch(
    castAssetSelectUrl(projectName, castMemberId, assetId),
    {
      method: 'DELETE',
      headers: {
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as CastAssetResponse;
  if (!body.asset) {
    throw new Error('Renku Studio API returned no cast asset.');
  }
  return body.asset;
}

export async function deleteCastAsset(
  projectName: string,
  castMemberId: string,
  assetId: string
): Promise<string> {
  const response = await fetch(castAssetUrl(projectName, castMemberId, assetId), {
    method: 'DELETE',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as CastAssetDeleteResponse;
  return body.assetId;
}

export function castAssetFileUrl(
  projectName: string,
  castMemberId: string,
  assetId: string,
  assetFileId: string
): string {
  return `${castAssetsUrl(projectName, castMemberId)}/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}

function castDesignResourceUrl(
  projectName: string,
  castMemberId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/cast/${encodeURIComponent(castMemberId)}/design`;
}

function castAssetsUrl(projectName: string, castMemberId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/cast/${encodeURIComponent(castMemberId)}/assets`;
}

function castAssetUrl(
  projectName: string,
  castMemberId: string,
  assetId: string
): string {
  return `${castAssetsUrl(projectName, castMemberId)}/${encodeURIComponent(assetId)}`;
}

function castAssetSelectUrl(
  projectName: string,
  castMemberId: string,
  assetId: string
): string {
  return `${castAssetsUrl(projectName, castMemberId)}/${encodeURIComponent(assetId)}/select`;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
