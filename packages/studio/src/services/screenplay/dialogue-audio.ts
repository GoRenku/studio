import type {
  SceneDialogueAudioWorkspace,
  SceneDialogueAudioSetup,
  SceneDialogueAudioWorkspaceMutationReport,
  SceneDialogueAudioTake,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from '@/services/studio-api-errors';

export type SceneDialogueAudioTakeWithUrl = SceneDialogueAudioTake & {
  url: string;
};

export type SceneDialogueAudioWorkspaceWithUrls = Omit<
  SceneDialogueAudioWorkspace,
  'audioByTurnId'
> & {
  audioByTurnId: Record<
    string,
    Omit<SceneDialogueAudioWorkspace['audioByTurnId'][string], 'takes'> & {
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
  turnId: string,
  setup: Partial<SceneDialogueAudioSetup>
): Promise<SceneDialogueAudioMutationWithUrls> {
  return sendMutation(
    `${turnAudioPath(projectName, sceneId, turnId)}/setup`,
    'PATCH',
    setup,
    projectName,
    sceneId
  );
}

export async function deleteSceneDialogueAudioTake(
  projectName: string,
  sceneId: string,
  turnId: string,
  takeId: string
): Promise<SceneDialogueAudioMutationWithUrls> {
  return sendMutation(
    `${turnAudioPath(projectName, sceneId, turnId)}/takes/${encodeURIComponent(takeId)}`,
    'DELETE',
    {},
    projectName,
    sceneId
  );
}

export async function selectSceneDialogueAudioTake(
  projectName: string,
  sceneId: string,
  turnId: string,
  takeId: string
): Promise<SceneDialogueAudioMutationWithUrls> {
  return sendMutation(
    `${turnAudioPath(projectName, sceneId, turnId)}/selected-take/${encodeURIComponent(takeId)}`,
    'PUT',
    undefined,
    projectName,
    sceneId
  );
}

export async function clearSceneDialogueAudioTakeSelection(
  projectName: string,
  sceneId: string,
  turnId: string
): Promise<SceneDialogueAudioMutationWithUrls> {
  return sendMutation(
    `${turnAudioPath(projectName, sceneId, turnId)}/selected-take`,
    'DELETE',
    undefined,
    projectName,
    sceneId
  );
}

function decorateSceneDialogueAudioWorkspace(
  projectName: string,
  sceneId: string,
  context: SceneDialogueAudioWorkspace
): SceneDialogueAudioWorkspaceWithUrls {
  return {
    ...context,
    audioByTurnId: Object.fromEntries(
      Object.entries(context.audioByTurnId).map(([turnId, audio]) => [
        turnId,
        {
          ...audio,
          takes: audio.takes.map((take) => ({
            ...take,
            url: takeFileUrl(projectName, sceneId, turnId, take),
          })),
        },
      ])
    ),
  };
}

async function sendMutation(
  path: string,
  method: 'DELETE' | 'PATCH' | 'POST' | 'PUT',
  body: unknown,
  projectName: string,
  sceneId: string
): Promise<SceneDialogueAudioMutationWithUrls> {
  const response = await fetch(path, {
    method,
    headers: jsonHeaders(),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
  turnId: string,
  take: SceneDialogueAudioTake
): string {
  return `${turnAudioPath(projectName, sceneId, turnId)}/takes/${encodeURIComponent(take.takeId)}/files/${encodeURIComponent(take.assetFileId)}`;
}

function turnAudioPath(projectName: string, sceneId: string, turnId: string): string {
  return `${dialogueTurnsPath(projectName, sceneId)}/${encodeURIComponent(turnId)}/audio`;
}

function dialogueAudioPath(projectName: string, sceneId: string): string {
  return `${dialogueTurnsPath(projectName, sceneId)}/audio`;
}

function dialogueTurnsPath(projectName: string, sceneId: string): string {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/screenplay/scenes/${encodeURIComponent(sceneId)}/dialogue-turns`;
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
