import type {
  GenerationReference,
  GenerationReferenceSlotSelectionInput,
  GenerationPreviewResource,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export interface UpdateGenerationPreviewResourceSpecInput {
  projectName: string;
  specId: string;
  prompt: {
    authoredText: string;
    negativeText?: string | null;
  };
  slotSelections: GenerationReferenceSlotSelectionInput[];
  genericReferences: GenerationReference[];
}

export async function updateGenerationPreviewResource(
  input: UpdateGenerationPreviewResourceSpecInput,
): Promise<GenerationPreviewResource> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(input.projectName)}/generation-previews/specs/${encodeURIComponent(input.specId)}`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({
        prompt: input.prompt,
        slotSelections: input.slotSelections,
        genericReferences: input.genericReferences,
      }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { preview: GenerationPreviewResource };
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
