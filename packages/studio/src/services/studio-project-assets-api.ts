import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import type {
  AssetFileSelectionReport,
  RecoverableMutationReport,
} from '@gorenku/studio-core/client';
import type {
  SceneDesignResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

interface StudioAssetFilesResponse {
  page: {
    items: StudioAssetFileResponse[];
    nextCursor: string | null;
    selectedAssetFileId: string | null;
  };
}

export interface StudioAssetFileCollection {
  items: StudioAssetFileResponse[];
  selectedAssetFileId: string | null;
}

export async function readProjectCoverAssetFiles(
  projectName: string
): Promise<StudioAssetFileCollection> {
  const assetFiles: StudioAssetFileResponse[] = [];
  let selectedAssetFileId: string | null = null;
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({
      ownerKind: 'project',
      type: 'project_cover',
      mediaKind: 'image',
      limit: '200',
    });
    if (cursor) search.set('cursor', cursor);
    const response = await studioApiFetch(
      `${projectAssetFilesUrl(projectName)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }
    const body = (await response.json()) as { page: StudioAssetFilesResponse['page'] };
    assetFiles.push(...body.page.items);
    selectedAssetFileId = body.page.selectedAssetFileId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assetFiles, selectedAssetFileId };
}

interface StudioCastVoiceDeleteResponse {
  removed: {
    castMemberId: string;
    voiceId: string;
    sampleAssetFileId: string;
  };
  resourceKeys?: string[];
}

interface SceneDesignResourceApiResponse {
  resource: SceneDesignResourceResponse | null;
}

export async function readCastAssetFiles(
  projectName: string,
  castMemberId: string
): Promise<StudioAssetFileCollection> {
  const assetFiles: StudioAssetFileResponse[] = [];
  let selectedAssetFileId: string | null = null;
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({ limit: '200' });
    if (cursor) search.set('cursor', cursor);
    const response = await studioApiFetch(
      `${castAssetFilesUrl(projectName, castMemberId)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }

    const body = (await response.json()) as StudioAssetFilesResponse;
    assetFiles.push(...body.page.items);
    selectedAssetFileId = body.page.selectedAssetFileId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assetFiles, selectedAssetFileId };
}

export async function readLocationAssetFiles(
  projectName: string,
  locationId: string
): Promise<StudioAssetFileCollection> {
  const assetFiles: StudioAssetFileResponse[] = [];
  let selectedAssetFileId: string | null = null;
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({ limit: '200' });
    if (cursor) search.set('cursor', cursor);
    const response = await studioApiFetch(
      `${locationAssetFilesUrl(projectName, locationId)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }

    const body = (await response.json()) as StudioAssetFilesResponse;
    assetFiles.push(...body.page.items);
    selectedAssetFileId = body.page.selectedAssetFileId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assetFiles, selectedAssetFileId };
}

export async function readPropAssetFiles(
  projectName: string,
  propId: string
): Promise<StudioAssetFileCollection> {
  const assetFiles: StudioAssetFileResponse[] = [];
  let selectedAssetFileId: string | null = null;
  let cursor: string | null = null;
  do {
    const search = new URLSearchParams({ limit: '200' });
    if (cursor) search.set('cursor', cursor);
    const response = await studioApiFetch(
      `${propAssetFilesUrl(projectName, propId)}?${search.toString()}`
    );
    if (!response.ok) {
      throw await readStudioApiError(response);
    }

    const body = (await response.json()) as StudioAssetFilesResponse;
    assetFiles.push(...body.page.items);
    selectedAssetFileId = body.page.selectedAssetFileId;
    cursor = body.page.nextCursor;
  } while (cursor);
  return { items: assetFiles, selectedAssetFileId };
}

export async function readSceneDesignResource(
  projectName: string,
  sceneId: string,
  role?: string
): Promise<SceneDesignResourceResponse> {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  const response = await studioApiFetch(
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

export async function selectCastProfileAssetFile(
  projectName: string,
  castMemberId: string,
  assetFileId: string
): Promise<AssetFileSelectionReport> {
  const response = await studioApiFetch(
    castProfileSelectionUrl(projectName, castMemberId, assetFileId),
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

  return await response.json() as AssetFileSelectionReport;
}

export async function clearSelectedCastProfile(
  projectName: string,
  castMemberId: string
): Promise<AssetFileSelectionReport> {
  const response = await studioApiFetch(
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

  return await response.json() as AssetFileSelectionReport;
}

export async function deleteCastAssetFile(
  projectName: string,
  castMemberId: string,
  assetFileId: string
): Promise<RecoverableMutationReport> {
  const response = await studioApiFetch(castAssetFileUrl(projectName, castMemberId, assetFileId), {
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
  const response = await studioApiFetch(castVoiceUrl(projectName, castMemberId, voiceId), {
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

export async function selectDefaultCastVoice(
  projectName: string,
  castMemberId: string,
  castVoiceId: string
): Promise<void> {
  const response = await studioApiFetch(
    `${castVoiceUrl(projectName, castMemberId, castVoiceId)}/default`,
    {
      method: 'PUT',
      headers: { 'X-Renku-Studio-Token': readStudioApiToken() },
    }
  );
  if (!response.ok) throw await readStudioApiError(response);
}

export async function selectLocationHeroAssetFile(
  projectName: string,
  locationId: string,
  assetFileId: string
): Promise<AssetFileSelectionReport> {
  const response = await studioApiFetch(
    locationHeroSelectionUrl(projectName, locationId, assetFileId),
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

  return await response.json() as AssetFileSelectionReport;
}

export async function clearSelectedLocationHero(
  projectName: string,
  locationId: string
): Promise<AssetFileSelectionReport> {
  const response = await studioApiFetch(
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

  return await response.json() as AssetFileSelectionReport;
}

export async function deleteLocationAssetFile(
  projectName: string,
  locationId: string,
  assetFileId: string
): Promise<RecoverableMutationReport> {
  const response = await studioApiFetch(locationAssetFileUrl(projectName, locationId, assetFileId), {
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

export async function selectPropHeroAssetFile(
  projectName: string,
  propId: string,
  assetFileId: string
): Promise<AssetFileSelectionReport> {
  const response = await studioApiFetch(
    propHeroSelectionUrl(projectName, propId, assetFileId),
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
  return await response.json() as AssetFileSelectionReport;
}

export async function clearSelectedPropHero(
  projectName: string,
  propId: string
): Promise<AssetFileSelectionReport> {
  const response = await studioApiFetch(propHeroSelectionUrl(projectName, propId), {
    method: 'DELETE',
    headers: {
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return await response.json() as AssetFileSelectionReport;
}

export async function deletePropAssetFile(
  projectName: string,
  propId: string,
  assetFileId: string
): Promise<RecoverableMutationReport> {
  const response = await studioApiFetch(propAssetFileUrl(projectName, propId, assetFileId), {
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

export async function selectProjectCoverAssetFile(
  projectName: string,
  assetFileId: string
): Promise<AssetFileSelectionReport> {
  return mutateProjectCoverSelection(projectName, assetFileId);
}

export async function clearSelectedProjectCover(
  projectName: string
): Promise<AssetFileSelectionReport> {
  return mutateProjectCoverSelection(projectName);
}

export async function deleteProjectCoverAssetFile(
  projectName: string,
  assetFileId: string
): Promise<RecoverableMutationReport> {
  const response = await studioApiFetch(
    `${projectCoversUrl(projectName)}/${encodeURIComponent(assetFileId)}`,
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
  assetFileId: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/asset-files/${encodeURIComponent(assetFileId)}`;
}

function projectAssetFilesUrl(projectName: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/asset-files`;
}

function projectCoversUrl(projectName: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/covers`;
}

async function mutateProjectCoverSelection(
  projectName: string,
  assetFileId?: string
): Promise<AssetFileSelectionReport> {
  const root = `/studio-api/projects/${encodeURIComponent(projectName)}/selected-cover`;
  const response = await studioApiFetch(
    assetFileId ? `${root}/${encodeURIComponent(assetFileId)}` : root,
    {
      method: assetFileId ? 'POST' : 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      ...(assetFileId ? { body: JSON.stringify({}) } : {}),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return await response.json() as AssetFileSelectionReport;
}

function castAssetFilesUrl(projectName: string, castMemberId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/cast/${encodeURIComponent(castMemberId)}/asset-files`;
}

function locationAssetFilesUrl(projectName: string, locationId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/locations/${encodeURIComponent(locationId)}/asset-files`;
}

function propAssetFilesUrl(projectName: string, propId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/props/${encodeURIComponent(propId)}/asset-files`;
}

function castAssetFileUrl(
  projectName: string,
  castMemberId: string,
  assetFileId: string
): string {
  return `${castAssetFilesUrl(projectName, castMemberId)}/${encodeURIComponent(assetFileId)}`;
}

function castVoiceUrl(
  projectName: string,
  castMemberId: string,
  voiceId: string
): string {
  return `${castAssetFilesUrl(projectName, castMemberId).replace(/\/asset-files$/, '/voices')}/${encodeURIComponent(voiceId)}`;
}

function locationAssetFileUrl(
  projectName: string,
  locationId: string,
  assetFileId: string
): string {
  return `${locationAssetFilesUrl(projectName, locationId)}/${encodeURIComponent(assetFileId)}`;
}

function propAssetFileUrl(
  projectName: string,
  propId: string,
  assetFileId: string
): string {
  return `${propAssetFilesUrl(projectName, propId)}/${encodeURIComponent(assetFileId)}`;
}

function castProfileSelectionUrl(
  projectName: string,
  castMemberId: string,
  assetFileId?: string
): string {
  const root = castAssetFilesUrl(projectName, castMemberId).replace(/\/asset-files$/, '/selected-profile');
  return assetFileId ? `${root}/${encodeURIComponent(assetFileId)}` : root;
}

function locationHeroSelectionUrl(
  projectName: string,
  locationId: string,
  assetFileId?: string
): string {
  const root = locationAssetFilesUrl(projectName, locationId).replace(/\/asset-files$/, '/selected-hero');
  return assetFileId ? `${root}/${encodeURIComponent(assetFileId)}` : root;
}

function propHeroSelectionUrl(
  projectName: string,
  propId: string,
  assetFileId?: string
): string {
  const root = propAssetFilesUrl(projectName, propId).replace(/\/asset-files$/, '/selected-hero');
  return assetFileId ? `${root}/${encodeURIComponent(assetFileId)}` : root;
}
