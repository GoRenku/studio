import type {
  ShotVideoTakeProductionContext,
  ShotVideoTakeInputPolicy,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelListReport,
  ShotVideoTakeProductionEstimateReport,
  SceneShotVideoTake,
  SceneShotVideoTakeShotDesign,
  SceneShotVideoTakeProductionState,
  ShotVideoTakeProductionPlanReport,
  SceneShotVideoTakeEditContext,
  RecoverableMutationReport,
  SceneShotVideoTakeListReport,
  SceneShotVideoTakeOverview,
  ShotVideoTakeStoryboardImageReference,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export type ShotVideoTakeStoryboardImageReferenceWithHttp =
  ShotVideoTakeStoryboardImageReference & {
    url: string;
  };

export type SceneShotVideoTakeOverviewResponse = Omit<
  SceneShotVideoTakeOverview,
  'storyboardImages'
> & {
  storyboardImages: ShotVideoTakeStoryboardImageReferenceWithHttp[];
};

export type SceneShotVideoTakeListReportResponse = Omit<
  SceneShotVideoTakeListReport,
  'takes'
> & {
  takes: SceneShotVideoTakeOverviewResponse[];
};

export type ShotVideoTakeProductionContextResponse = Omit<
  ShotVideoTakeProductionContext,
  'storyboardImages'
> & {
  storyboardImages: ShotVideoTakeStoryboardImageReferenceWithHttp[];
};

export type SceneShotVideoTakeEditContextResponse = Omit<
  SceneShotVideoTakeEditContext,
  'storyboardImages'
> & {
  storyboardImages: ShotVideoTakeStoryboardImageReferenceWithHttp[];
};

/** The dependency input slot the reuse/regenerate controls act on (0041). */
export interface ShotVideoTakeInputSlot {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export interface ShotVideoTakeProductionRead {
  context: ShotVideoTakeProductionContextResponse;
  models: ShotVideoTakeModelListReport;
}

interface TakeMutationResponse {
  context: ShotVideoTakeProductionContextResponse;
  resourceKeys: string[];
  recovery?: RecoverableMutationReport['recovery'];
}

export interface ShotVideoTakeProductionMutation {
  context: ShotVideoTakeProductionContextResponse;
  resourceKeys: string[];
  recovery?: RecoverableMutationReport['recovery'];
}

export interface ShotVideoTakePlanRead {
  report: ShotVideoTakeProductionPlanReport;
}

export interface SceneShotVideoTakeEditContextRead {
  editContext: SceneShotVideoTakeEditContextResponse;
}

export type SceneShotVideoTakesRead = SceneShotVideoTakeListReportResponse;

export interface SceneShotVideoTakeMutation {
  take: SceneShotVideoTake;
  resourceKeys: string[];
}

export interface SceneShotVideoTakeDeleteMutation {
  resourceKeys: string[];
  recovery: RecoverableMutationReport['recovery'];
}

export async function listSceneShotVideoTakes(
  projectName: string,
  sceneId: string
): Promise<SceneShotVideoTakesRead> {
  const response = await fetch(takesPath(projectName, sceneId));
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as SceneShotVideoTakesRead;
}

export async function createSceneShotVideoTake(
  projectName: string,
  sceneId: string,
  input: { shotListId: string; shotIds: string[]; title?: string }
): Promise<SceneShotVideoTake> {
  const response = await fetch(takesPath(projectName, sceneId), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as {
    take: SceneShotVideoTake;
  };
  return body.take;
}

export async function deleteSceneShotVideoTake(
  projectName: string,
  sceneId: string,
  takeId: string
): Promise<SceneShotVideoTakeDeleteMutation> {
  return sendMutation<SceneShotVideoTakeDeleteMutation>(
    productionPath(projectName, sceneId, takeId),
    'DELETE',
    {}
  );
}

export async function updateSceneShotVideoTakePick(
  projectName: string,
  sceneId: string,
  takeId: string,
  picked: boolean
): Promise<SceneShotVideoTakeMutation> {
  return sendMutation<SceneShotVideoTakeMutation>(
    `${productionPath(projectName, sceneId, takeId)}/pick`,
    'PATCH',
    { picked }
  );
}

export async function updateSceneShotVideoTakeShots(
  projectName: string,
  sceneId: string,
  takeId: string,
  shotIds: string[]
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/shots`,
    'PATCH',
    { shotIds }
  );
}

export async function readSceneShotVideoTakeEditContext(
  projectName: string,
  sceneId: string,
  takeId: string
): Promise<SceneShotVideoTakeEditContextResponse> {
  const response = await fetch(
    `${productionPath(projectName, sceneId, takeId)}/edit-context`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as SceneShotVideoTakeEditContextRead;
  return body.editContext;
}

/** Read the AI Production planning context and the model report together. */
export async function readShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  takeId: string,
  inputModeId?: ShotVideoTakeInputModeId
): Promise<ShotVideoTakeProductionRead> {
  const search = new URLSearchParams();
  if (inputModeId) {
    search.set('inputModeId', inputModeId);
  }
  const query = search.size > 0 ? `?${search.toString()}` : '';
  const response = await fetch(`${productionPath(projectName, sceneId, takeId)}${query}`);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as ShotVideoTakeProductionRead;
}

/** Autosave the take production setup through core. */
export async function updateShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  takeId: string,
  production: SceneShotVideoTakeProductionState
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    productionPath(projectName, sceneId, takeId),
    'PATCH',
    { production }
  );
}

export async function updateSceneShotVideoTakeShotDesign(
  projectName: string,
  sceneId: string,
  takeId: string,
  shotId: string,
  shotDesign: SceneShotVideoTakeShotDesign | null
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/shots/${encodeURIComponent(shotId)}/design`,
    'PATCH',
    { shotDesign }
  );
}

/** Estimate the current production setup without opening the preflight plan. */
export async function estimateShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  takeId: string,
  production: SceneShotVideoTakeProductionState
): Promise<ShotVideoTakeProductionEstimateReport> {
  const response = await fetch(
    `${productionPath(projectName, sceneId, takeId)}/estimate`,
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
  takeId: string,
  production?: SceneShotVideoTakeProductionState,
  inputPolicy: ShotVideoTakeInputPolicy = { defaultMode: 'auto' }
): Promise<ShotVideoTakeProductionPlanReport> {
  const response = await fetch(`${productionPath(projectName, sceneId, takeId)}/plan`, {
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

export async function updateTakeCharacterSheetSelection(
  projectName: string,
  sceneId: string,
  takeId: string,
  input: { castMemberId: string; assetId: string | null }
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/reference-selections/character-sheets`,
    'PATCH',
    input
  );
}

export async function updateTakeLocationSheetSelection(
  projectName: string,
  sceneId: string,
  takeId: string,
  input: { locationId: string; assetIds: string[] }
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/reference-selections/location-sheets`,
    'PATCH',
    input
  );
}

export async function updateTakeLookbookSheetSelection(
  projectName: string,
  sceneId: string,
  takeId: string,
  lookbookSheetId: string | null
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/reference-selections/lookbook-sheets`,
    'PATCH',
    { lookbookSheetId }
  );
}

export async function updateTakeDialogueAudioSelection(
  projectName: string,
  sceneId: string,
  takeId: string,
  input: { dialogueId: string; takeId: string | null }
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/reference-selections/dialogue-audio`,
    'PATCH',
    input
  );
}

export async function updateShotGroupReferenceInclusion(
  projectName: string,
  sceneId: string,
  takeId: string,
  input: { dependencyId: string; inclusion: 'include' | 'exclude' | null }
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/reference-inclusions`,
    'PATCH',
    input
  );
}

/** Reuse an existing dependency input for the take. */
export async function selectShotVideoTakeInput(
  projectName: string,
  sceneId: string,
  takeId: string,
  inputId: string
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/inputs/select`,
    'POST',
    { inputId }
  );
}

/** Clear a dependency input selection so the agent regenerates it (0041). */
export async function clearShotVideoTakeInput(
  projectName: string,
  sceneId: string,
  takeId: string,
  inputSlot: ShotVideoTakeInputSlot
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/inputs/clear`,
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
  takeId: string,
  inputId: string
): Promise<ShotVideoTakeProductionMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/inputs/${encodeURIComponent(inputId)}`,
    'DELETE',
    {}
  );
}

async function sendTakeMutation(
  path: string,
  method: 'DELETE' | 'PATCH' | 'POST',
  body: unknown
): Promise<TakeMutationResponse> {
  return sendMutation<TakeMutationResponse>(path, method, body);
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

function takesPath(projectName: string, sceneId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/takes`;
}

function productionPath(
  projectName: string,
  sceneId: string,
  takeId: string
): string {
  return `${takesPath(projectName, sceneId)}/${encodeURIComponent(takeId)}`;
}
