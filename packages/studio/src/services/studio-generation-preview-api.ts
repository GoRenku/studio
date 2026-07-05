import type { StudioGenerationPreview } from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export async function updateCastCharacterSheetPreviewReference(input: {
  projectName: string;
  specId: string;
  dependencyId: string;
  inclusion: 'include' | 'exclude' | null;
}): Promise<StudioGenerationPreview> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(input.projectName)}/generation-previews/specs/${encodeURIComponent(input.specId)}/reference-inclusion`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({
        dependencyId: input.dependencyId,
        inclusion: input.inclusion,
      }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { preview: StudioGenerationPreview };
  return body.preview;
}

function jsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Renku-Studio-Token': readStudioApiToken(),
  };
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
