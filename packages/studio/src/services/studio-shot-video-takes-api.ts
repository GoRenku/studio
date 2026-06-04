import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputPolicy,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelListReport,
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionGroup,
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

interface MutationResponse {
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}

export interface ShotVideoTakeProductionMutation {
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}

export interface ShotVideoTakePlanRead {
  report: ShotVideoTakeProductionPlanReport;
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
  inputModeId?: ShotVideoTakeInputModeId
): Promise<ShotVideoTakeProductionRead> {
  const search = new URLSearchParams({ shotIds: shotIds.join(',') });
  if (inputModeId) {
    search.set('inputModeId', inputModeId);
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
): Promise<ShotVideoTakeProductionPlanReport> {
  const response = await fetch(`${productionPath(projectName, sceneId)}/plan`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ productionGroup, inputPolicy }),
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
): Promise<ShotVideoTakeProductionMutation> {
  return sendMutation(shotReferencePath(projectName, sceneId, shotId, 'cast-references'), 'PATCH', {
    castMemberIds,
  });
}

export async function updateShotLocationReference(
  projectName: string,
  sceneId: string,
  shotId: string,
  input: { locationId: string; azimuthView?: 'front' | 'right' | 'back' | 'left' }
): Promise<ShotVideoTakeProductionMutation> {
  return sendMutation(
    shotReferencePath(projectName, sceneId, shotId, 'location-reference'),
    'PATCH',
    input
  );
}

export async function updateShotLookbookReference(
  projectName: string,
  sceneId: string,
  shotId: string,
  lookbookSheetId: string | null
): Promise<ShotVideoTakeProductionMutation> {
  return sendMutation(
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
): Promise<ShotVideoTakeProductionMutation> {
  return sendMutation(
    shotReferencePath(projectName, sceneId, shotId, 'custom-reference-images'),
    'PATCH',
    { customReferenceInputIds }
  );
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

function shotReferencePath(
  projectName: string,
  sceneId: string,
  shotId: string,
  suffix: string
): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/shots/${encodeURIComponent(shotId)}/${suffix}`;
}
