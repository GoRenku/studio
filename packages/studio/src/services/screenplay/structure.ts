import type {
  ScreenplaySectionResourceResponse,
  ScreenplayStructureResourceResponse,
} from '@/services/studio-project-contracts';
import { readStudioApiError } from '@/services/studio-api-errors';

export async function readScreenplayStructure(
  projectName: string
): Promise<ScreenplayStructureResourceResponse> {
  return readResource(screenplayPath(projectName, '/structure'));
}

export async function readScreenplaySection(
  projectName: string,
  sectionId: string
): Promise<ScreenplaySectionResourceResponse> {
  return readResource(
    screenplayPath(projectName, `/sections/${encodeURIComponent(sectionId)}`)
  );
}

async function readResource<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { resource: T | null };
  if (!body.resource) {
    throw new Error('Renku Studio API returned no screenplay resource.');
  }
  return body.resource;
}

function screenplayPath(projectName: string, path: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay${path}`;
}
