import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import { readStudioApiError } from '@/services/studio-api-errors';

export async function updateMediaGenerationPreview(input: {
  projectName: string;
  documentPath: string;
  prompt: string;
}): Promise<MediaGenerationPreviewResource> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(input.projectName)}/generation-previews/files?path=${encodeURIComponent(input.documentPath)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify({ prompt: input.prompt }),
    },
  );
  if (!response.ok) throw await readStudioApiError(response);
  return ((await response.json()) as { preview: MediaGenerationPreviewResource }).preview;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) throw new Error('Studio API token is not available.');
  return token;
}
