import type {
  SceneDialogueAudioEstimateReport,
  SceneDialogueAudioWorkspace,
  SceneDialogueAudioSetup,
  SceneDialogueAudioWorkspaceMutationReport,
  SceneDialogueAudioTake,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export type SceneDialogueAudioTakeWithUrl = SceneDialogueAudioTake & {
  url: string;
};

export type SceneDialogueAudioWorkspaceWithUrls = Omit<
  SceneDialogueAudioWorkspace,
  'audioByDialogueId'
> & {
  audioByDialogueId: Record<
    string,
    Omit<SceneDialogueAudioWorkspace['audioByDialogueId'][string], 'takes'> & {
      takes: SceneDialogueAudioTakeWithUrl[];
    }
  >;
};

export interface SceneDialogueAudioMutationWithUrls {
  context: SceneDialogueAudioWorkspaceWithUrls;
  resourceKeys: string[];
}

export async function readSceneDialogueAudioWorkspace(
  projectName: string,
  sceneId: string
): Promise<SceneDialogueAudioWorkspaceWithUrls> {
  const response = await fetch(dialogueAudioPath(projectName, sceneId));
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { context: SceneDialogueAudioWorkspace };
  return decorateSceneDialogueAudioWorkspace(projectName, sceneId, body.context);
}

export async function saveSceneDialogueAudioSetup(
  projectName: string,
  sceneId: string,
  dialogueId: string,
  setup: Partial<SceneDialogueAudioSetup>
): Promise<SceneDialogueAudioMutationWithUrls> {
  return sendMutation(
    `${dialogueAudioPath(projectName, sceneId)}/${encodeURIComponent(dialogueId)}/setup`,
    'PATCH',
    setup,
    projectName,
    sceneId
  );
}

export async function estimateSceneDialogueAudioDraft(
  projectName: string,
  sceneId: string,
  dialogueId: string,
  spec: SceneDialogueAudioSetup
): Promise<SceneDialogueAudioEstimateReport> {
  const response = await fetch(
    `${dialogueAudioPath(projectName, sceneId)}/${encodeURIComponent(dialogueId)}/estimate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec }),
    }
  );
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const body = (await response.json()) as { estimate: SceneDialogueAudioEstimateReport };
  return body.estimate;
}

export async function generateSceneDialogueAudioTake(
  projectName: string,
  sceneId: string,
  dialogueId: string,
  input: {
    setup: Partial<SceneDialogueAudioSetup>;
    simulate?: boolean;
    approveLiveProviderRun?: boolean;
  }
): Promise<SceneDialogueAudioMutationWithUrls> {
  return sendMutation(
    `${dialogueAudioPath(projectName, sceneId)}/${encodeURIComponent(dialogueId)}/generate`,
    'POST',
    input,
    projectName,
    sceneId
  );
}

export async function deleteSceneDialogueAudioTake(
  projectName: string,
  sceneId: string,
  dialogueId: string,
  takeId: string
): Promise<SceneDialogueAudioMutationWithUrls> {
  return sendMutation(
    `${dialogueAudioPath(projectName, sceneId)}/${encodeURIComponent(dialogueId)}/takes/${encodeURIComponent(takeId)}`,
    'DELETE',
    {},
    projectName,
    sceneId
  );
}

export function decorateSceneDialogueAudioWorkspace(
  projectName: string,
  sceneId: string,
  context: SceneDialogueAudioWorkspace
): SceneDialogueAudioWorkspaceWithUrls {
  return {
    ...context,
    audioByDialogueId: Object.fromEntries(
      Object.entries(context.audioByDialogueId).map(([dialogueId, audio]) => [
        dialogueId,
        {
          ...audio,
          takes: audio.takes.map((take) => ({
            ...take,
            url: takeFileUrl(projectName, sceneId, dialogueId, take),
          })),
        },
      ])
    ),
  };
}

async function sendMutation(
  path: string,
  method: 'DELETE' | 'PATCH' | 'POST',
  body: unknown,
  projectName: string,
  sceneId: string
): Promise<SceneDialogueAudioMutationWithUrls> {
  const response = await fetch(path, {
    method,
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readStudioApiError(response);
  }
  const report = (await response.json()) as SceneDialogueAudioWorkspaceMutationReport;
  return {
    context: decorateSceneDialogueAudioWorkspace(projectName, sceneId, report.context),
    resourceKeys: report.resourceKeys,
  };
}

function takeFileUrl(
  projectName: string,
  sceneId: string,
  dialogueId: string,
  take: SceneDialogueAudioTake
): string {
  return `${dialogueAudioPath(projectName, sceneId)}/${encodeURIComponent(dialogueId)}/takes/${encodeURIComponent(take.takeId)}/files/${encodeURIComponent(take.assetFileId)}`;
}

function dialogueAudioPath(projectName: string, sceneId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/dialogue-audio`;
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
