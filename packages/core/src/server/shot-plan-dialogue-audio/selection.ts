import type { ShotPlanDialogueAudioMutationReport } from '../../client/shot-plan-dialogue-audio.js';
import {
  readShotPlanDialogueAudioTakeRecord,
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
  requireTake(input);
  setShotPlanDialogueAudioTakeSelectedAt(input.session, {
    takeId: input.takeId,
    selectedAt: input.now,
    updatedAt: input.now,
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
}): void {
  if (!readShotPlanDialogueAudioTakeRecord(input.session, input)) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_INVALID',
      `Active Dialogue Audio Take does not belong to Shot Plan ${input.shotPlanId}: ${input.takeId}.`
    );
  }
}

function report(input: {
  session: DatabaseSession;
  shotPlanId: string;
}): ShotPlanDialogueAudioMutationReport {
  const resource = readShotPlanDialogueAudio(input);
  return { valid: true, warnings: [], resource, resourceKeys: resource.resourceKeys };
}
