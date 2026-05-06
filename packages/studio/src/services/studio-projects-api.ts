import type {
  ProjectLibraryWithHttp,
  ProjectWithHttp,
} from '@/services/studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

interface ProjectResponse {
  project: ProjectWithHttp | null;
}

interface LibraryResponse {
  library: ProjectLibraryWithHttp;
}

export async function selectProject(projectName: string): Promise<ProjectWithHttp> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/select`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as ProjectResponse;
  if (!body.project) {
    throw new Error('Renku Studio API returned no project.');
  }
  return body.project;
}

export async function readCurrentProject(): Promise<ProjectWithHttp | null> {
  const response = await fetch('/studio-api/projects/current');
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ProjectResponse;
  return body.project;
}

export async function readProjectLibrary(): Promise<ProjectLibraryWithHttp> {
  const response = await fetch('/studio-api/projects');
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as LibraryResponse;
  return body.library;
}
