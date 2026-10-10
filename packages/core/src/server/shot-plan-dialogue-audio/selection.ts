import type { ShotPlanDialogueAudioMutationReport } from '../../client/shot-plan-dialogue-audio.js';
import {
  clearOverlappingShotPlanDialogueAudioTakeSelections,
  readShotPlanDialogueAudioTakeRecord,
  type ShotPlanDialogueAudioTakeRecord,
  setShotPlanDialogueAudioTakeSelectedAt,
} from '../database/access/shot-plan-dialogue-audio.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { readShotPlanDialogueAudio } from './projection.js';

export function selectShotPlanDialogueAudioTake(input: {
  session: DatabaseSession;
  shotPlanId: string;
  takeId: string;
  now: string;
}): ShotPlanDialogueAudioMutationReport {
  const take = requireTake(input);
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    clearOverlappingShotPlanDialogueAudioTakeSelections(session, {
      shotPlanId: input.shotPlanId,
      exceptTakeId: take.id,
      turnStartNumber: take.turnStartNumber,
      turnEndNumber: take.turnEndNumber,
      updatedAt: input.now,
    });
    setShotPlanDialogueAudioTakeSelectedAt(session, {
      takeId: take.id,
      selectedAt: input.now,
      updatedAt: input.now,
    });
  });
  return report(input);
}

export function clearShotPlanDialogueAudioTakeSelection(input: {
  session: DatabaseSession;
  shotPlanId: string;
  takeId: string;
  now: string;
}): ShotPlanDialogueAudioMutationReport {
  requireTake(input);
  setShotPlanDialogueAudioTakeSelectedAt(input.session, {
    takeId: input.takeId,
    selectedAt: null,
    updatedAt: input.now,
  });
  return report(input);
}

function requireTake(input: {
  session: DatabaseSession;
  shotPlanId: string;
  takeId: string;
}): ShotPlanDialogueAudioTakeRecord {
  const take = readShotPlanDialogueAudioTakeRecord(input.session, input);
  if (!take) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_INVALID',
      `Active Dialogue Audio Take does not belong to Shot Plan ${input.shotPlanId}: ${input.takeId}.`
    );
  }
  return take;
}

function report(input: {
  session: DatabaseSession;
  shotPlanId: string;
}): ShotPlanDialogueAudioMutationReport {
  const resource = readShotPlanDialogueAudio(input);
  return { valid: true, warnings: [], resource, resourceKeys: resource.resourceKeys };
}
