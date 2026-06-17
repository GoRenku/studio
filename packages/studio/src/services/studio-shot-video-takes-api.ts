import type {
  LocationAzimuthViewId,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputPolicy,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelListReport,
  ShotVideoTakeProductionEstimateReport,
  SceneShotVideoTakeGeneration,
  ShotVideoTakeGenerationProduction,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from './studio-project-contracts';
import { readStudioApiError } from './studio-api-errors';

/** The dependency input slot the reuse/regenerate controls act on (0041). */
export interface ShotVideoTakeInputSlot {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export interface ShotVideoTakeProductionRead {
  context: ShotVideoTakeGenerationContext;
  models: ShotVideoTakeModelListReport;
}

interface TakeGenerationMutationResponse {
  context: ShotVideoTakeGenerationContext;
  resourceKeys: string[];
}

export interface ShotVideoTakeProductionMutation {
  context: ShotVideoTakeGenerationContext;
  resourceKeys: string[];
}

interface ResourceMutationResponse {
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}

export interface ShotVideoTakeResourceMutation {
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}

export interface ShotVideoTakePlanRead {
  report: ShotVideoTakeProductionPlanReport;
}

export interface SceneShotVideoTakeGenerationsRead {
  takeGenerations: SceneShotVideoTakeGeneration[];
}

export async function listSceneShotVideoTakeGenerations(
  projectName: string,
  sceneId: string
): Promise<SceneShotVideoTakeGenerationsRead> {
  const response = await fetch(takeGenerationsPath(projectName, sceneId));
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as SceneShotVideoTakeGenerationsRead;
}

export async function createSceneShotVideoTakeGeneration(
  projectName: string,
  sceneId: string,
  input: { shotListId: string; shotIds: string[]; title?: string }
): Promise<SceneShotVideoTakeGeneration> {
  const response = await fetch(takeGenerationsPath(projectName, sceneId), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as {
    takeGeneration: SceneShotVideoTakeGeneration;
  };
  return body.takeGeneration;
}

export async function updateSceneShotVideoTakeGenerationShots(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  shotIds: string[]
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeGenerationMutation(
    `${productionPath(projectName, sceneId, takeGenerationId)}/shots`,
    'PATCH',
    { shotIds }
  );
}

/** Read the AI Production planning context and the model report together. */
export async function readShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  inputModeId?: ShotVideoTakeInputModeId
): Promise<ShotVideoTakeProductionRead> {
  const search = new URLSearchParams();
  if (inputModeId) {
    search.set('inputModeId', inputModeId);
  }
  const query = search.size > 0 ? `?${search.toString()}` : '';
  const response = await fetch(`${productionPath(projectName, sceneId, takeGenerationId)}${query}`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as ShotVideoTakeProductionRead;
}

/** Autosave the take-generation production setup through core. */
export async function updateShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  production: ShotVideoTakeGenerationProduction
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeGenerationMutation(
    productionPath(projectName, sceneId, takeGenerationId),
    'PATCH',
    { production }
  );
}

/** Estimate the current production setup without opening the preflight plan. */
export async function estimateShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  production: ShotVideoTakeGenerationProduction
): Promise<ShotVideoTakeProductionEstimateReport> {
  const response = await fetch(
    `${productionPath(projectName, sceneId, takeGenerationId)}/estimate`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ production }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as {
    estimate: ShotVideoTakeProductionEstimateReport;
  };
  return body.estimate;
}

export async function planShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  production?: ShotVideoTakeGenerationProduction,
  inputPolicy: ShotVideoTakeInputPolicy = { defaultMode: 'auto' }
): Promise<ShotVideoTakeProductionPlanReport> {
  const response = await fetch(`${productionPath(projectName, sceneId, takeGenerationId)}/plan`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ ...(production ? { production } : {}), inputPolicy }),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ShotVideoTakePlanRead;
  return body.report;
}

export async function updateShotCastReferences(
  projectName: string,
  sceneId: string,
  shotId: string,
  castMemberIds: string[]
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(shotReferencePath(projectName, sceneId, shotId, 'cast-references'), 'PATCH', {
    castMemberIds,
  });
}

export async function updateShotLocationReference(
  projectName: string,
  sceneId: string,
  shotId: string,
  locationId: string
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    shotReferencePath(projectName, sceneId, shotId, 'location-reference'),
    'PATCH',
    { locationId }
  );
}

export async function updateShotCastCharacterSheetReference(
  projectName: string,
  sceneId: string,
  shotId: string,
  input: { castMemberId: string; assetId: string | null }
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    shotReferencePath(projectName, sceneId, shotId, 'cast-character-sheet-reference'),
    'PATCH',
    input
  );
}

export async function updateShotLocationSheetReference(
  projectName: string,
  sceneId: string,
  shotId: string,
  input: { locationId: string; assetId: string | null }
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    shotReferencePath(projectName, sceneId, shotId, 'location-sheet-reference'),
    'PATCH',
    input
  );
}

export async function updateShotLocationViewReferences(
  projectName: string,
  sceneId: string,
  shotId: string,
  input: {
    locationId: string;
    assetId: string;
    viewIds: LocationAzimuthViewId[];
  }
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    shotReferencePath(projectName, sceneId, shotId, 'location-view-references'),
    'PATCH',
    input
  );
}

export async function updateShotLookbookReference(
  projectName: string,
  sceneId: string,
  shotId: string,
  lookbookSheetId: string | null
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    shotReferencePath(projectName, sceneId, shotId, 'lookbook-reference'),
    'PATCH',
    { lookbookSheetId }
  );
}

export async function updateShotCustomReferenceImages(
  projectName: string,
  sceneId: string,
  shotId: string,
  customReferenceInputIds: string[]
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    shotReferencePath(projectName, sceneId, shotId, 'reference-images'),
    'PATCH',
    { customReferenceInputIds }
  );
}

export async function updateShotReferenceInclusion(
  projectName: string,
  sceneId: string,
  shotId: string,
  input: { dependencyId: string; inclusion: 'include' | 'exclude' | null }
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    shotReferencePath(projectName, sceneId, shotId, 'reference-inclusions'),
    'PATCH',
    input
  );
}

export async function updateShotGroupReferenceInclusion(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  input: { dependencyId: string; inclusion: 'include' | 'exclude' | null }
): Promise<ShotVideoTakeResourceMutation> {
  return sendResourceMutation(
    `${productionPath(projectName, sceneId, takeGenerationId)}/reference-inclusions`,
    'PATCH',
    input
  );
}

/** Reuse an existing dependency input for the take generation. */
export async function selectShotVideoTakeInput(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  inputId: string
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeGenerationMutation(
    `${productionPath(projectName, sceneId, takeGenerationId)}/inputs/select`,
    'POST',
    { inputId }
  );
}

/** Clear a dependency input selection so the agent regenerates it (0041). */
export async function clearShotVideoTakeInput(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  inputSlot: ShotVideoTakeInputSlot
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeGenerationMutation(
    `${productionPath(projectName, sceneId, takeGenerationId)}/inputs/clear`,
    'POST',
    {
      kind: inputSlot.kind,
      ...(inputSlot.subjectKind ? { subjectKind: inputSlot.subjectKind } : {}),
      ...(inputSlot.subjectId ? { subjectId: inputSlot.subjectId } : {}),
    }
  );
}

/** Delete one imported/generated dependency input take from the group. */
export async function deleteShotVideoTakeInput(
  projectName: string,
  sceneId: string,
  takeGenerationId: string,
  inputId: string
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeGenerationMutation(
    `${productionPath(projectName, sceneId, takeGenerationId)}/inputs/${encodeURIComponent(inputId)}`,
    'DELETE',
    {}
  );
}

async function sendTakeGenerationMutation(
  path: string,
  method: 'DELETE' | 'PATCH' | 'POST',
  body: unknown
): Promise<TakeGenerationMutationResponse> {
  return sendMutation<TakeGenerationMutationResponse>(path, method, body);
}

async function sendResourceMutation(
  path: string,
  method: 'DELETE' | 'PATCH' | 'POST',
  body: unknown
): Promise<ResourceMutationResponse> {
  return sendMutation<ResourceMutationResponse>(path, method, body);
}

async function sendMutation<T>(
  path: string,
  method: 'DELETE' | 'PATCH' | 'POST',
  body: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as T;
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

function takeGenerationsPath(projectName: string, sceneId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/take-generations`;
}

function productionPath(
  projectName: string,
  sceneId: string,
  takeGenerationId: string
): string {
  return `${takeGenerationsPath(projectName, sceneId)}/${encodeURIComponent(takeGenerationId)}`;
}

function shotReferencePath(
  projectName: string,
  sceneId: string,
  shotId: string,
  suffix: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/shots/${encodeURIComponent(shotId)}/${suffix}`;
}
