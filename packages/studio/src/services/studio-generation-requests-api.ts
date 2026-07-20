import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export async function readAssetFileGenerationRequest(input: {
  projectName: string;
  assetId: string;
  assetFileId: string;
}): Promise<GenerationPreviewResource> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(input.projectName)}/assets/${encodeURIComponent(input.assetId)}/files/${encodeURIComponent(input.assetFileId)}/generation-request`,
    { headers: { 'X-Renku-Studio-Token': readStudioApiToken() } },
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return ((await response.json()) as { preview: GenerationPreviewResource }).preview;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
