import type {
  DialogueTurnRange,
  ShotPlanDialogueAudioResource,
  ShotPlanDialogueAudioSpeaker,
  ShotPlanDialogueAudioTake,
} from '../../client/shot-plan-dialogue-audio.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import {
  listShotPlanDialogueAudioTakeRecords,
  readShotPlanDialogueAudioTakeRecord,
} from '../database/access/shot-plan-dialogue-audio.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { firstImageForContinuitySubject } from '../resources/continuity-subjects.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { listNumberedDialogueTurns } from '../screenplay/dialogue-turns.js';
import { studioShotPlanDialogueAudioResourceKey } from '../studio-coordination/resource-keys.js';

export function readShotPlanDialogueAudio(input: {
  session: DatabaseSession;
  shotPlanId: string;
}): ShotPlanDialogueAudioResource {
  const shotPlan = requireShotPlanRecord(input.session, input.shotPlanId);
  const screenplay = readCanonicalScreenplay(input.session);
  const dialogueTurns = listNumberedDialogueTurns(screenplay, shotPlan.sceneId);
  const takes = listShotPlanDialogueAudioTakeRecords(input.session, shotPlan.id).map((record) => {
    const asset = readOwnedAsset(input.session, {
      owner: { kind: 'project' },
      assetId: record.assetId,
    });
    if (!asset || !asset.files.some((file) => file.id === record.assetFileId && file.mediaKind === 'audio')) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_DIALOGUE_AUDIO_FILE_INVALID',
        `Dialogue Audio Take ${record.id} has no active audio file.`
      );
    }
    const turnRange = {
      start: record.turnStartNumber,
      end: record.turnEndNumber,
    };
    return {
      id: record.id,
      shotPlanId: record.shotPlanId,
      asset,
      turnRange,
      selected: record.selectedAt !== null,
      speakers: speakersForRange(input.session, dialogueTurns, turnRange),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    } satisfies ShotPlanDialogueAudioTake;
  }).sort(compareDialogueAudioTakes);
  return {
    shotPlan: {
      id: shotPlan.id,
      sceneId: shotPlan.sceneId,
      title: shotPlan.title,
    },
    takes,
    resourceKeys: [studioShotPlanDialogueAudioResourceKey(shotPlan.id)],
  };
}

function compareDialogueAudioTakes(
  left: ShotPlanDialogueAudioTake,
  right: ShotPlanDialogueAudioTake,
): number {
  return left.turnRange.start - right.turnRange.start
    || left.turnRange.end - right.turnRange.end
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id);
}

export function requireShotPlanDialogueAudioTakeFile(input: {
  session: DatabaseSession;
  shotPlanId: string;
  takeId: string;
  assetFileId: string;
}): { assetId: string; assetFileId: string } {
  const take = readShotPlanDialogueAudioTakeRecord(input.session, input);
  if (!take || take.assetFileId !== input.assetFileId) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_DIALOGUE_AUDIO_FILE_INVALID',
      `Dialogue Audio file does not belong to Take ${input.takeId}.`,
    );
  }
  const asset = readOwnedAsset(input.session, {
    owner: { kind: 'project' },
    assetId: take.assetId,
  });
  if (!asset?.files.some(
    (file) => file.id === input.assetFileId && file.mediaKind === 'audio'
  )) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_DIALOGUE_AUDIO_FILE_INVALID',
      `Dialogue Audio Take ${input.takeId} has no active audio file ${input.assetFileId}.`,
    );
  }
  return { assetId: take.assetId, assetFileId: input.assetFileId };
}

function speakersForRange(
  session: DatabaseSession,
  dialogueTurns: ReturnType<typeof listNumberedDialogueTurns>,
  range: DialogueTurnRange,
): ShotPlanDialogueAudioSpeaker[] {
  const speakers: ShotPlanDialogueAudioSpeaker[] = [];
  const seen = new Set<string>();
  for (const context of dialogueTurns.filter(
    (candidate) => candidate.number >= range.start && candidate.number <= range.end
  )) {
    const castMember = context.castMemberId
      ? readCastMemberRecord(session, context.castMemberId)
      : null;
    const speakerName = castMember?.name ?? context.turn.characterName;
    const key = context.castMemberId ? `cast:${context.castMemberId}` : `name:${speakerName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    speakers.push({
      castMemberId: context.castMemberId,
      speakerName,
      isVoiceOver: castMember?.isVoiceOver ?? false,
      selectedProfile: context.castMemberId
        ? firstImageForContinuitySubject(session, {
            kind: 'castMember',
            id: context.castMemberId,
          }) ?? null
        : null,
    });
  }
  return speakers;
}
