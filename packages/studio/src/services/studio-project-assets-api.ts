import type {
  MarkdownAssetContent,
  RichTextAssetLink,
} from '@gorenku/studio-core';
import type {
  ProjectWithHttp,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

interface MarkdownAssetContentResponse {
  content: MarkdownAssetContent | null;
}

interface MarkdownAssetContentUpdateResponse {
  content: MarkdownAssetContent | null;
  project: ProjectWithHttp | null;
}

interface CastAssetsResponse {
  assets: StudioAssetResponse[];
}

interface CastAssetResponse {
  asset: StudioAssetResponse | null;
}

export async function readCastAssets(
  projectName: string,
  castMemberId: string
): Promise<StudioAssetResponse[]> {
  const response = await fetch(castAssetsUrl(projectName, castMemberId));
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as CastAssetsResponse;
  return body.assets;
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

export function castAssetFileUrl(
  projectName: string,
  castMemberId: string,
  assetId: string,
  assetFileId: string
): string {
  return `${castAssetsUrl(projectName, castMemberId)}/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}

export async function readMarkdownAssetContent(
  projectName: string,
  asset: Pick<RichTextAssetLink, 'assetId' | 'assetFileId'>
): Promise<MarkdownAssetContent> {
  const response = await fetch(markdownAssetContentUrl(projectName, asset));
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as MarkdownAssetContentResponse;
  if (!body.content) {
    throw new Error('Renku Studio API returned no Markdown asset content.');
  }
  return body.content;
}

export async function updateMarkdownAssetContent(
  projectName: string,
  asset: Pick<RichTextAssetLink, 'assetId' | 'assetFileId'>,
  content: string
): Promise<{ content: MarkdownAssetContent; project: ProjectWithHttp }> {
  const response = await fetch(markdownAssetContentUrl(projectName, asset), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Renku-Studio-Token': readStudioApiToken(),
    },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as MarkdownAssetContentUpdateResponse;
  if (!body.content || !body.project) {
    throw new Error(
      'Renku Studio API returned no Markdown asset update result.'
    );
  }
  return {
    content: body.content,
    project: body.project,
  };
}

function markdownAssetContentUrl(
  projectName: string,
  asset: Pick<RichTextAssetLink, 'assetId' | 'assetFileId'>
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/markdown-assets/${encodeURIComponent(asset.assetId)}/files/${encodeURIComponent(asset.assetFileId)}/content`;
}

function castAssetsUrl(projectName: string, castMemberId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/cast/${encodeURIComponent(castMemberId)}/assets`;
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
