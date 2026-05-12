import type {
  MarkdownAssetContent,
  RichTextAssetLink,
} from '@gorenku/studio-core';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

interface MarkdownAssetContentResponse {
  content: MarkdownAssetContent | null;
}

interface MarkdownAssetContentUpdateResponse {
  content: MarkdownAssetContent | null;
  project: ProjectWithHttp | null;
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

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
