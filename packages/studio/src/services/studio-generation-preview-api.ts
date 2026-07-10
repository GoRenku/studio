import type { StudioGenerationPreview } from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export interface UpdateStudioGenerationPreviewSpecInput {
  projectName: string;
  specId: string;
  prompt: {
    authoredText: string;
    negativeText?: string | null;
  };
  referenceSelections: Array<{
    dependencyId: string;
    selected: boolean;
  }>;
}

export async function updateGenerationPreviewSpec(
  input: UpdateStudioGenerationPreviewSpecInput,
): Promise<StudioGenerationPreview> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(input.projectName)}/generation-previews/specs/${encodeURIComponent(input.specId)}`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({
        prompt: input.prompt,
        referenceSelections: input.referenceSelections,
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
