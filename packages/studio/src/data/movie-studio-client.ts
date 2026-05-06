import type {
  ProjectLibraryWithHttp,
  ProjectWithHttp,
} from '@/types/movie-project';

interface ProjectResponse {
  project: ProjectWithHttp | null;
}

interface LibraryResponse {
  library: ProjectLibraryWithHttp;
}

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function openProject(projectName: string): Promise<ProjectWithHttp> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/select`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    throw await readRequestError(response);
  }

  const body = (await response.json()) as ProjectResponse;
  if (!body.project) {
    throw new Error('Renku Studio API returned no project.');
  }
  return body.project;
}

export async function fetchCurrentProject(): Promise<ProjectWithHttp | null> {
  const response = await fetch('/studio-api/projects/current');
  if (!response.ok) {
    throw await readRequestError(response);
  }
  const body = (await response.json()) as ProjectResponse;
  return body.project;
}

export async function fetchProjectLibrary(): Promise<ProjectLibraryWithHttp> {
  const response = await fetch('/studio-api/projects');
  if (!response.ok) {
    throw await readRequestError(response);
  }
  const body = (await response.json()) as LibraryResponse;
  return body.library;
}

async function readRequestError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ErrorResponse;
    const code = body.error?.code;
    const message = body.error?.message ?? response.statusText;
    return new Error(code ? `${code}: ${message}` : message);
  } catch {
    return new Error(response.statusText);
  }
}
