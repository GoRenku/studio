import type {
  MovieStudioSelectionContextRequest,
  MovieStudioSelectionContextResponse,
  ProjectInformationUpdateRequest,
  ProjectLibraryWithHttp,
  ProductionExportSummaryResponse,
  ProjectShellWithHttp,
} from '@/services/studio-project-contracts';
import './studio-current-contracts';
import { readStudioApiError } from './studio-api-errors';

interface ProjectResponse {
  project: ProjectShellWithHttp | null;
}

interface LibraryResponse {
  library: ProjectLibraryWithHttp;
}

interface ProductionExportResponse {
  summary: ProductionExportSummaryResponse;
}

export async function readProject(projectName: string): Promise<ProjectShellWithHttp> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}`
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

export async function readProjectLibrary(): Promise<ProjectLibraryWithHttp> {
  const response = await fetch('/studio-api/projects');
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as LibraryResponse;
  return body.library;
}

export async function readMovieStudioSelectionContext(
  projectName: string,
  request: MovieStudioSelectionContextRequest
): Promise<MovieStudioSelectionContextResponse> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/movie-studio-selection/context`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as MovieStudioSelectionContextResponse;
}

export async function updateProjectInformation(
  projectName: string,
  information: ProjectInformationUpdateRequest
): Promise<ProjectShellWithHttp> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/information`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify(information),
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

export async function exportProductionAssets(
  projectName: string
): Promise<ProductionExportSummaryResponse> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/production-export`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    throw await readStudioApiError(response);
  }

  const body = (await response.json()) as ProductionExportResponse;
  return body.summary;
}

function readStudioApiToken(): string {
  const token = window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken;
  if (!token) {
    throw new Error('Studio API token is not available.');
  }
  return token;
}
