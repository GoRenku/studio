import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationPlan,
  ShotVideoTakeInputPolicy,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeIntentId,
  ShotVideoTakeModelListReport,
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionGroup,
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

interface MutationResponse {
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}

export interface ShotVideoTakeProductionMutation {
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}

export interface ShotVideoTakePlanRead {
  plan: ShotVideoTakeGenerationPlan;
}

/**
 * Read the AI Production planning context and the model report together in one
 * request, avoiding a UI-driven waterfall (0041). `shotIds` are sent as a
 * comma-separated ordered list.
 */
export async function readShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  shotIds: string[],
  intentId?: ShotVideoTakeIntentId
): Promise<ShotVideoTakeProductionRead> {
  const search = new URLSearchParams({ shotIds: shotIds.join(',') });
  if (intentId) {
    search.set('intentId', intentId);
  }
  const response = await fetch(
    `${productionPath(projectName, sceneId)}?${search.toString()}`
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as ShotVideoTakeProductionRead;
}

/** Autosave the production group through core (0041). */
export async function updateShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  productionGroup: ShotVideoTakeProductionGroup
): Promise<ShotVideoTakeProductionMutation> {
  return sendMutation(productionPath(projectName, sceneId), 'PATCH', {
    productionGroup,
  });
}

/** Open the preflight report for the current production group (0041). */
export async function previewShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  productionGroup: ShotVideoTakeProductionGroup
): Promise<ShotVideoTakePreflightReport> {
  const response = await fetch(
    `${productionPath(projectName, sceneId)}/preview`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ productionGroup }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as {
    preflight: ShotVideoTakePreflightReport;
  };
  return body.preflight;
}

/** Estimate the current production setup without opening the preflight plan. */
export async function estimateShotVideoTakeProduction(
  projectName: string,
  sceneId: string,
  productionGroup: ShotVideoTakeProductionGroup
): Promise<ShotVideoTakeProductionEstimateReport> {
  const response = await fetch(
    `${productionPath(projectName, sceneId)}/estimate`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ productionGroup }),
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
  productionGroup: ShotVideoTakeProductionGroup,
  inputPolicy: ShotVideoTakeInputPolicy = { defaultMode: 'auto' }
): Promise<ShotVideoTakeGenerationPlan> {
  const response = await fetch(`${productionPath(projectName, sceneId)}/plan`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ productionGroup, inputPolicy }),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as ShotVideoTakePlanRead;
  return body.plan;
}

/** Reuse an existing dependency input for the group (0041). */
export async function selectShotVideoTakeInput(
  projectName: string,
  sceneId: string,
  shotIds: string[],
  inputId: string
): Promise<ShotVideoTakeProductionMutation> {
  return sendMutation(
    `${productionPath(projectName, sceneId)}/inputs/select`,
    'POST',
    { shotIds, inputId }
  );
}

/** Clear a dependency input selection so the agent regenerates it (0041). */
export async function clearShotVideoTakeInput(
  projectName: string,
  sceneId: string,
  shotIds: string[],
  inputSlot: ShotVideoTakeInputSlot
): Promise<ShotVideoTakeProductionMutation> {
  return sendMutation(
    `${productionPath(projectName, sceneId)}/inputs/clear`,
    'POST',
    {
      shotIds,
      kind: inputSlot.kind,
      ...(inputSlot.subjectKind ? { subjectKind: inputSlot.subjectKind } : {}),
      ...(inputSlot.subjectId ? { subjectId: inputSlot.subjectId } : {}),
    }
  );
}

async function sendMutation(
  path: string,
  method: 'PATCH' | 'POST',
  body: unknown
): Promise<MutationResponse> {
  const response = await fetch(path, {
    method,
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as MutationResponse;
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

function productionPath(projectName: string, sceneId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/video-take-production`;
}
