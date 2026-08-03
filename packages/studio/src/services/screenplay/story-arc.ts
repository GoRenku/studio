import type { StoryArcResourceResponse } from '@/services/studio-project-contracts';
import { readStudioApiError } from '@/services/studio-api-errors';

export async function readStoryArcResource(
  projectName: string
): Promise<StoryArcResourceResponse> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/story-arc`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as {
    resource: StoryArcResourceResponse | null;
  };
  if (!body.resource) {
    throw new Error('Renku Studio API returned no Story Arc resource.');
  }
  return body.resource;
}
