import type {
  AssetFileSelectionReport,
  CastingCandidateStatus,
  CastingCandidateStatusReport,
} from '@gorenku/studio-core/client';
import { readStudioApiToken, studioApiFetch } from './studio-api-fetch';
import { readStudioApiError } from './studio-api-errors';
import type { CastCastingResourceResponse } from './studio-project-contracts';

export async function readCastCasting(
  projectName: string,
  castMemberId: string
): Promise<CastCastingResourceResponse> {
  const response = await studioApiFetch(`${castMemberPath(projectName, castMemberId)}/casting`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { resource: CastCastingResourceResponse | null };
  if (!body.resource) {
    throw new Error('Renku Studio API returned no casting resource.');
  }
  return body.resource;
}

export async function setCastingCandidateStatus(
  projectName: string,
  castMemberId: string,
  assetFileId: string,
  status: CastingCandidateStatus
): Promise<CastingCandidateStatusReport> {
  const response = await studioApiFetch(
    `${castMemberPath(projectName, castMemberId)}/casting/candidates/${encodeURIComponent(assetFileId)}/status`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': readStudioApiToken(),
      },
      body: JSON.stringify({ status }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return await response.json() as CastingCandidateStatusReport;
}

export async function castLookCandidate(
  projectName: string,
  castMemberId: string,
  lookId: string,
  assetFileId: string
): Promise<AssetFileSelectionReport> {
  return putSelection(
    `${castMemberPath(projectName, castMemberId)}/looks/${encodeURIComponent(lookId)}/selected-candidate/${encodeURIComponent(assetFileId)}`
  );
}

export async function selectCostumeCharacterSheet(
  projectName: string,
  castMemberId: string,
  costumeId: string,
  assetFileId: string
): Promise<AssetFileSelectionReport> {
  return putSelection(
    `${castMemberPath(projectName, castMemberId)}/costumes/${encodeURIComponent(costumeId)}/selected-sheet/${encodeURIComponent(assetFileId)}`
  );
}

async function putSelection(url: string): Promise<AssetFileSelectionReport> {
  const response = await studioApiFetch(url, {
    method: 'PUT',
    headers: { 'X-Renku-Studio-Token': readStudioApiToken() },
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return await response.json() as AssetFileSelectionReport;
}

function castMemberPath(projectName: string, castMemberId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/cast/${encodeURIComponent(castMemberId)}`;
}
