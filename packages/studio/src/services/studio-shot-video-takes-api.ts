import type {
  SceneShotVideoTake,
  SceneShotVideoTakeCreateReport,
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeStructureMode,
  GenerationCostEstimateReport,
  GenerationReference,
  GenerationReferenceSlotSelectionInput,
  RecoverableMutationReport,
  SceneShotVideoTakeListReport,
  SceneShotVideoTakeOverview,
  ShotVideoTakeGenerationSetup,
  SceneShotVideoTakeReferenceWorkspace,
  ShotVideoTakeDraftReferenceSections,
  ShotVideoTakeStoryboardImageReference,
  ShotVideoTakeWorkspace,
  SceneShotVideoTakeVideo,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export type ShotVideoTakeStoryboardImageReferenceWithHttp =
  ShotVideoTakeStoryboardImageReference & {
    url: string;
  };

export type SceneShotVideoTakeVideoWithHttp = SceneShotVideoTakeVideo & {
  url: string;
};

export type SceneShotVideoTakeWithHttp = Omit<
  SceneShotVideoTake,
  'video'
> & {
  video: SceneShotVideoTakeVideoWithHttp | null;
};

export type SceneShotVideoTakeOverviewResponse = Omit<
  SceneShotVideoTakeOverview,
  'take' | 'storyboardImages'
> & {
  take: SceneShotVideoTakeWithHttp;
  storyboardImages: ShotVideoTakeStoryboardImageReferenceWithHttp[];
};

export type SceneShotVideoTakeListReportResponse = Omit<
  SceneShotVideoTakeListReport,
  'takes'
> & {
  takes: SceneShotVideoTakeOverviewResponse[];
};

export type SceneShotVideoTakeCreateReportResponse = Omit<
  SceneShotVideoTakeCreateReport,
  'overview'
> & {
  overview: SceneShotVideoTakeOverviewResponse;
};

export type ShotVideoTakeWorkspaceResponse = Omit<
  ShotVideoTakeWorkspace,
  'take' | 'storyboardImages' | 'generation'
> & {
  take: SceneShotVideoTakeWithHttp;
  storyboardImages: ShotVideoTakeStoryboardImageReferenceWithHttp[];
  generation: Omit<ShotVideoTakeWorkspace['generation'], 'references'> & {
    references: ShotVideoTakeReferenceWorkspaceWithHttp;
  };
};

type ShotVideoTakeDraftReferenceSectionsWithHttp = Omit<
  ShotVideoTakeDraftReferenceSections,
  'general' | 'genericReferences' | 'lookbook' | 'castMembers' | 'locations'
> & {
  general: Array<ReferenceChoiceWithHttp<ShotVideoTakeDraftReferenceSections['general'][number]>>;
  genericReferences: Array<ShotVideoTakeDraftReferenceSections['genericReferences'][number] & {
    browserUrl?: string;
  }>;
  lookbook: Array<ReferenceChoiceWithHttp<ShotVideoTakeDraftReferenceSections['lookbook'][number]>>;
  castMembers: Array<Omit<ShotVideoTakeDraftReferenceSections['castMembers'][number], 'characterSheets'> & {
    characterSheets: Array<ReferenceChoiceWithHttp<ShotVideoTakeDraftReferenceSections['castMembers'][number]['characterSheets'][number]>>;
  }>;
  locations: Array<Omit<ShotVideoTakeDraftReferenceSections['locations'][number], 'environmentSheets'> & {
    environmentSheets: Array<ReferenceChoiceWithHttp<ShotVideoTakeDraftReferenceSections['locations'][number]['environmentSheets'][number]>>;
  }>;
};

type ShotVideoTakeReferenceWorkspaceWithHttp =
  | ShotVideoTakeDraftReferenceSectionsWithHttp
  | Extract<SceneShotVideoTakeReferenceWorkspace, { kind: 'completed' }>;

type ReferenceChoiceWithHttp<T extends { card: { previews: unknown[] } }> = Omit<T, 'card'> & {
  card: Omit<T['card'], 'previews'> & {
    previews: Array<T['card']['previews'][number] & { url: string }>;
  };
};

interface TakeMutationResponse {
  workspace: ShotVideoTakeWorkspaceResponse;
  resourceKeys: string[];
  recovery?: RecoverableMutationReport['recovery'];
}

export interface ShotVideoTakeWorkspaceMutation {
  workspace: ShotVideoTakeWorkspaceResponse;
  resourceKeys: string[];
  recovery?: RecoverableMutationReport['recovery'];
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

export async function listShotVideoTakes(
  projectName: string,
  sceneId: string
): Promise<SceneShotVideoTakesRead> {
  const response = await fetch(takesPath(projectName, sceneId));
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as SceneShotVideoTakesRead;
}

export async function createShotVideoTake(
  projectName: string,
  sceneId: string,
  input: { shotListId: string; shotIds: string[]; title?: string }
): Promise<SceneShotVideoTakeCreateReportResponse> {
  const response = await fetch(takesPath(projectName, sceneId), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  return (await response.json()) as SceneShotVideoTakeCreateReportResponse;
}

export async function discardShotVideoTake(
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

export async function createSceneShotVideoTakeFromTake(
  projectName: string,
  sceneId: string,
  takeId: string
): Promise<SceneShotVideoTakeCreateReportResponse> {
  return sendMutation<SceneShotVideoTakeCreateReportResponse>(
    `${productionPath(projectName, sceneId, takeId)}/new`,
    'POST',
    {}
  );
}

export async function setShotVideoTakePicked(
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

export async function replaceShotVideoTakeShots(
  projectName: string,
  sceneId: string,
  takeId: string,
  shotIds: string[]
): Promise<ShotVideoTakeWorkspaceMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/shots`,
    'PATCH',
    { shotIds }
  );
}

export async function readShotVideoTakeWorkspace(
  projectName: string,
  sceneId: string,
  takeId: string,
  selectedShotId?: string
): Promise<ShotVideoTakeWorkspaceResponse> {
  const path = productionPath(projectName, sceneId, takeId);
  const response = await fetch(selectedShotId
    ? `${path}?selectedShotId=${encodeURIComponent(selectedShotId)}`
    : path);
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { workspace: ShotVideoTakeWorkspaceResponse };
  return body.workspace;
}

export async function setShotVideoTakeGenerationSpec(
  projectName: string,
  sceneId: string,
  takeId: string,
  setup: ShotVideoTakeGenerationSetup,
  selectedShotId?: string
): Promise<ShotVideoTakeWorkspaceMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/generation`,
    'PATCH',
    { setup, ...(selectedShotId ? { selectedShotId } : {}) }
  );
}

export async function setShotVideoTakeDirection(
  projectName: string,
  sceneId: string,
  takeId: string,
  direction: SceneShotVideoTakeDirection | null,
  shotId?: string
): Promise<ShotVideoTakeWorkspaceMutation> {
  const path = shotId
    ? `${productionPath(projectName, sceneId, takeId)}/shots/${encodeURIComponent(shotId)}/direction`
    : `${productionPath(projectName, sceneId, takeId)}/direction`;
  return sendTakeMutation(
    path,
    'PATCH',
    { direction }
  );
}

export async function setShotVideoTakeStructure(
  projectName: string,
  sceneId: string,
  takeId: string,
  mode: SceneShotVideoTakeStructureMode,
  sourceShotId?: string
): Promise<ShotVideoTakeWorkspaceMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/structure`,
    'PATCH',
    { mode, ...(sourceShotId ? { sourceShotId } : {}) }
  );
}

/** Estimate the selected model from pricing inputs only. */
export async function estimateShotVideoTakeGeneration(
  projectName: string,
  sceneId: string,
  takeId: string,
  setup: ShotVideoTakeGenerationSetup
): Promise<GenerationCostEstimateReport> {
  const response = await fetch(
    `${productionPath(projectName, sceneId, takeId)}/estimate`,
    {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ setup }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as {
    estimate: GenerationCostEstimateReport;
  };
  return body.estimate;
}

export async function setShotVideoTakeGenerationReference(
  projectName: string,
  sceneId: string,
  takeId: string,
  input: { selection: GenerationReferenceSlotSelectionInput; selectedShotId?: string }
): Promise<ShotVideoTakeWorkspaceMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/generation/references`,
    'PATCH',
    input
  );
}

export async function setShotVideoTakeGenerationGenericReferences(
  projectName: string,
  sceneId: string,
  takeId: string,
  input: { references: GenerationReference[]; selectedShotId?: string }
): Promise<ShotVideoTakeWorkspaceMutation> {
  return sendTakeMutation(
    `${productionPath(projectName, sceneId, takeId)}/generation/generic-references`,
    'PATCH',
    input
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
