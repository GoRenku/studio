import type {
  ProjectInformationUpdateRequest,
  ProjectLibraryWithHttp,
  ProductionExportSummaryResponse,
  ProjectWithHttp,
} from '@/services/studio-project-contracts';
import './studio-current-contracts';
import { readStudioApiError } from './studio-api-errors';

interface ProjectResponse {
  project: ProjectWithHttp | null;
}

interface LibraryResponse {
  library: ProjectLibraryWithHttp;
}

interface ProductionExportResponse {
  summary: ProductionExportSummaryResponse;
}

export async function selectProject(projectName: string): Promise<ProjectWithHttp> {
  const response = await fetch(
    `/studio-api/projects/${encodeURIComponent(projectName)}/select`,
    {
      method: 'POST',
      headers: {
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
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

export async function readProject(projectName: string): Promise<ProjectWithHttp> {
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

export async function updateProjectInformation(
  projectName: string,
  information: ProjectInformationUpdateRequest
): Promise<ProjectWithHttp> {
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
