import type {
  AssetSelectionReport,
  RecoverableMutationReport,
} from '@gorenku/studio-core/client';
import type {
  SceneDesignResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

interface StudioAssetsResponse {
  assets: StudioAssetResponse[];
  page: {
    items: StudioAssetResponse[];
    nextCursor: string | null;
    selectedAssetId: string | null;
  };
}

export interface StudioAssetCollection {
  items: StudioAssetResponse[];
  selectedAssetId: string | null;
}

export async function readProjectCoverAssets(
  projectName: string
): Promise<StudioAssetCollection> {
  const assets: StudioAssetResponse[] = [];
  let selectedAssetId: string | null = null;
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({
      ownerKind: 'project',
      type: 'project_cover',
      mediaKind: 'image',
      limit: '200',
    });
    if (cursor) search.set('cursor', cursor);
    const response = await fetch(
      `${projectAssetsUrl(projectName)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }
    const body = (await response.json()) as { page: StudioAssetsResponse['page'] };
    assets.push(...body.page.items);
    selectedAssetId = body.page.selectedAssetId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assets, selectedAssetId };
}

interface StudioCastVoiceDeleteResponse {
  removed: {
    castMemberId: string;
    voiceId: string;
    sampleAssetId: string;
  };
  resourceKeys?: string[];
}

interface SceneDesignResourceApiResponse {
  resource: SceneDesignResourceResponse | null;
}

export async function readCastAssets(
  projectName: string,
  castMemberId: string
): Promise<StudioAssetCollection> {
  const assets: StudioAssetResponse[] = [];
  let selectedAssetId: string | null = null;
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

    const body = (await response.json()) as StudioAssetsResponse;
    assets.push(...body.page.items);
    selectedAssetId = body.page.selectedAssetId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assets, selectedAssetId };
}

export async function readLocationAssets(
  projectName: string,
  locationId: string
): Promise<StudioAssetCollection> {
  const assets: StudioAssetResponse[] = [];
  let selectedAssetId: string | null = null;
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({ limit: '200' });
    if (cursor) search.set('cursor', cursor);
    const response = await fetch(
      `${locationAssetsUrl(projectName, locationId)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }

    const body = (await response.json()) as StudioAssetsResponse;
    assets.push(...body.page.items);
    selectedAssetId = body.page.selectedAssetId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assets, selectedAssetId };
}

export async function readPropAssets(
  projectName: string,
  propId: string
): Promise<StudioAssetCollection> {
  const assets: StudioAssetResponse[] = [];
  let selectedAssetId: string | null = null;
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({ limit: '200' });
    if (cursor) search.set('cursor', cursor);
    const response = await fetch(
      `${propAssetsUrl(projectName, propId)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }

    const body = (await response.json()) as StudioAssetsResponse;
    assets.push(...body.page.items);
    selectedAssetId = body.page.selectedAssetId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assets, selectedAssetId };
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

export async function selectCastProfileAsset(
  projectName: string,
  castMemberId: string,
  assetId: string
): Promise<AssetSelectionReport> {
  const response = await fetch(
    castProfileSelectionUrl(projectName, castMemberId, assetId),
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

  return await response.json() as AssetSelectionReport;
}

export async function clearSelectedCastProfile(
  projectName: string,
  castMemberId: string
): Promise<AssetSelectionReport> {
  const response = await fetch(
    castProfileSelectionUrl(projectName, castMemberId),
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

  return await response.json() as AssetSelectionReport;
}

export async function deleteCastAsset(
  projectName: string,
  castMemberId: string,
  assetId: string
): Promise<RecoverableMutationReport> {
  const response = await fetch(castAssetUrl(projectName, castMemberId, assetId), {
    method: 'DELETE',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  return await response.json() as RecoverableMutationReport;
}

export async function deleteCastVoice(
  projectName: string,
  castMemberId: string,
  voiceId: string
): Promise<StudioCastVoiceDeleteResponse['removed']> {
  const response = await fetch(castVoiceUrl(projectName, castMemberId, voiceId), {
    method: 'DELETE',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as StudioCastVoiceDeleteResponse;
  return body.removed;
}

export async function selectLocationHeroAsset(
  projectName: string,
  locationId: string,
  assetId: string
): Promise<AssetSelectionReport> {
  const response = await fetch(
    locationHeroSelectionUrl(projectName, locationId, assetId),
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

  return await response.json() as AssetSelectionReport;
}

export async function clearSelectedLocationHero(
  projectName: string,
  locationId: string
): Promise<AssetSelectionReport> {
  const response = await fetch(
    locationHeroSelectionUrl(projectName, locationId),
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

  return await response.json() as AssetSelectionReport;
}

export async function deleteLocationAsset(
  projectName: string,
  locationId: string,
  assetId: string
): Promise<RecoverableMutationReport> {
  const response = await fetch(locationAssetUrl(projectName, locationId, assetId), {
    method: 'DELETE',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  return await response.json() as RecoverableMutationReport;
}

export async function selectPropHeroAsset(
  projectName: string,
  propId: string,
  assetId: string
): Promise<AssetSelectionReport> {
  const response = await fetch(
    propHeroSelectionUrl(projectName, propId, assetId),
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
  return await response.json() as AssetSelectionReport;
}

export async function clearSelectedPropHero(
  projectName: string,
  propId: string
): Promise<AssetSelectionReport> {
  const response = await fetch(propHeroSelectionUrl(projectName, propId), {
    method: 'DELETE',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return await response.json() as AssetSelectionReport;
}

export async function deletePropAsset(
  projectName: string,
  propId: string,
  assetId: string
): Promise<RecoverableMutationReport> {
  const response = await fetch(propAssetUrl(projectName, propId, assetId), {
    method: 'DELETE',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return await response.json() as RecoverableMutationReport;
}

export async function selectProjectCoverAsset(
  projectName: string,
  assetId: string
): Promise<AssetSelectionReport> {
  return mutateProjectCoverSelection(projectName, assetId);
}

export async function clearSelectedProjectCover(
  projectName: string
): Promise<AssetSelectionReport> {
  return mutateProjectCoverSelection(projectName);
}

export async function deleteProjectCoverAsset(
  projectName: string,
  assetId: string
): Promise<RecoverableMutationReport> {
  const response = await fetch(
    `${projectCoversUrl(projectName)}/${encodeURIComponent(assetId)}`,
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
  return await response.json() as RecoverableMutationReport;
}

export function projectAssetFileUrl(
  projectName: string,
  assetId: string,
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}

function projectAssetsUrl(projectName: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets`;
}

function projectCoversUrl(projectName: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/covers`;
}

async function mutateProjectCoverSelection(
  projectName: string,
  assetId?: string
): Promise<AssetSelectionReport> {
  const root = `/studio-api/projects/${encodeURIComponent(projectName)}/selected-cover`;
  const response = await fetch(
    assetId ? `${root}/${encodeURIComponent(assetId)}` : root,
    {
      method: assetId ? 'POST' : 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      ...(assetId ? { body: JSON.stringify({}) } : {}),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return await response.json() as AssetSelectionReport;
}

function castAssetsUrl(projectName: string, castMemberId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/cast/${encodeURIComponent(castMemberId)}/assets`;
}

function locationAssetsUrl(projectName: string, locationId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/locations/${encodeURIComponent(locationId)}/assets`;
}

function propAssetsUrl(projectName: string, propId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/props/${encodeURIComponent(propId)}/assets`;
}

function castAssetUrl(
  projectName: string,
  castMemberId: string,
  assetId: string
): string {
  return `${castAssetsUrl(projectName, castMemberId)}/${encodeURIComponent(assetId)}`;
}

function castVoiceUrl(
  projectName: string,
  castMemberId: string,
  voiceId: string
): string {
  return `${castAssetsUrl(projectName, castMemberId).replace(/\/assets$/, '/voices')}/${encodeURIComponent(voiceId)}`;
}

function locationAssetUrl(
  projectName: string,
  locationId: string,
  assetId: string
): string {
  return `${locationAssetsUrl(projectName, locationId)}/${encodeURIComponent(assetId)}`;
}

function propAssetUrl(
  projectName: string,
  propId: string,
  assetId: string
): string {
  return `${propAssetsUrl(projectName, propId)}/${encodeURIComponent(assetId)}`;
}

function castProfileSelectionUrl(
  projectName: string,
  castMemberId: string,
  assetId?: string
): string {
  const root = castAssetsUrl(projectName, castMemberId).replace(/\/assets$/, '/selected-profile');
  return assetId ? `${root}/${encodeURIComponent(assetId)}` : root;
}

function locationHeroSelectionUrl(
  projectName: string,
  locationId: string,
  assetId?: string
): string {
  const root = locationAssetsUrl(projectName, locationId).replace(/\/assets$/, '/selected-hero');
  return assetId ? `${root}/${encodeURIComponent(assetId)}` : root;
}

function propHeroSelectionUrl(
  projectName: string,
  propId: string,
  assetId?: string
): string {
  const root = propAssetsUrl(projectName, propId).replace(/\/assets$/, '/selected-hero');
  return assetId ? `${root}/${encodeURIComponent(assetId)}` : root;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
