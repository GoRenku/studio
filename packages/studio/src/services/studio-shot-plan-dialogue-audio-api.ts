import type {
  ShotPlanDialogueAudioResource,
  ShotPlanDialogueAudioTake,
} from '@gorenku/studio-core/client';
import { readStudioApiError } from './studio-api-errors';

export type StudioShotPlanDialogueAudioTake = Omit<
  ShotPlanDialogueAudioTake,
  'asset' | 'speakers'
> & {
  audioUrl: string;
  durationSeconds: number | null;
  provenance: ShotPlanDialogueAudioTake['asset']['generationProvenance'];
  speakers: Array<ShotPlanDialogueAudioTake['speakers'][number] & {
    profileUrl: string | null;
  }>;
};

export type StudioShotPlanDialogueAudioResource = Omit<
  ShotPlanDialogueAudioResource,
  'takes'
> & { takes: StudioShotPlanDialogueAudioTake[] };

export async function readShotPlanDialogueAudio(input: {
  projectName: string;
  shotPlanId: string;
  signal?: AbortSignal;
}): Promise<StudioShotPlanDialogueAudioResource> {
  const resource = await readJson<ShotPlanDialogueAudioResource>(baseUrl(input), {
    signal: input.signal,
  });
  return {
    ...resource,
    takes: resource.takes.map((take) => {
      const file = take.asset.files.find((candidate) => candidate.mediaKind === 'audio')!;
      return {
        id: take.id,
        shotPlanId: take.shotPlanId,
        turnRange: take.turnRange,
        selected: take.selected,
        createdAt: take.createdAt,
        updatedAt: take.updatedAt,
        audioUrl: `${baseUrl(input)}/takes/${encodeURIComponent(take.id)}/files/${encodeURIComponent(file.id)}`,
        durationSeconds: file.durationSeconds,
        provenance: take.asset.generationProvenance,
        speakers: take.speakers.map((speaker) => ({
          ...speaker,
          profileUrl: speaker.selectedProfile
            ? genericAssetFileUrl(input.projectName, speaker.selectedProfile.assetId, speaker.selectedProfile.assetFileId)
            : null,
        })),
      };
    }),
  };
}

export function selectShotPlanDialogueAudioTake(input: {
  projectName: string;
  shotPlanId: string;
  takeId: string;
}) {
  return mutate(input, 'PUT', 'selection');
}

export function clearShotPlanDialogueAudioTakeSelection(input: {
  projectName: string;
  shotPlanId: string;
  takeId: string;
}) {
  return mutate(input, 'DELETE', 'selection');
}

export function deleteShotPlanDialogueAudioTake(input: {
  projectName: string;
  shotPlanId: string;
  takeId: string;
}) {
  return mutate(input, 'DELETE');
}

async function mutate(
  input: { projectName: string; shotPlanId: string; takeId: string },
  method: 'PUT' | 'DELETE',
  suffix?: 'selection',
) {
  return readJson(
    `${baseUrl(input)}/takes/${encodeURIComponent(input.takeId)}${suffix ? `/${suffix}` : ''}`,
    {
      method,
      headers: { 'X-Renku-Studio-Token': readStudioApiToken() },
    },
  );
}

async function readJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw await readStudioApiError(response);
  return response.json() as Promise<T>;
}

function baseUrl(input: { projectName: string; shotPlanId: string }) {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/screenplay/shot-plans/${encodeURIComponent(input.shotPlanId)}/dialogue-audio`;
}

function genericAssetFileUrl(projectName: string, assetId: string, assetFileId: string) {
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(assetId)}/files/${encodeURIComponent(assetFileId)}`;
}

function readStudioApiToken(): string {
  return window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken ?? '';
}
