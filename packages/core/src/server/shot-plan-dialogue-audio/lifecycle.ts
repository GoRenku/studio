import type { ShotPlanDialogueAudioMutationReport } from '../../client/shot-plan-dialogue-audio.js';
import {
  readShotPlanDialogueAudioTakeByAssetId,
  readShotPlanDialogueAudioTakeRecord,
} from '../database/access/shot-plan-dialogue-audio.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { readShotPlanDialogueAudio } from './projection.js';

export function discardShotPlanDialogueAudioTake(input: {
  session: DatabaseSession;
  projectFolder: string;
  shotPlanId: string;
  takeId: string;
}): ShotPlanDialogueAudioMutationReport {
  const take = readShotPlanDialogueAudioTakeRecord(input.session, input);
  const project = readProjectRecord(input.session);
  if (!take || !project) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_NOT_FOUND',
      `Shot Plan Dialogue Audio Take was not found: ${input.takeId}.`
    );
  }
  const recovery = discardTrashObject({
    session: input.session,
    project,
    projectFolder: input.projectFolder,
    itemKind: 'shotPlanDialogueAudioTake',
    itemId: input.takeId,
    commandName: 'shot-plan-dialogue-audio.take.discard',
    changes: [{ type: 'shotPlanDialogueAudioTake.discarded', takeId: input.takeId }],
  });
  const resource = readShotPlanDialogueAudio(input);
  return {
    valid: true,
    warnings: [],
    resource,
    recovery: recovery.recovery,
    resourceKeys: resource.resourceKeys,
  };
}

export function assertAssetIsNotShotPlanDialogueAudioTake(
  session: DatabaseSession,
  assetId: string,
): void {
  const take = readShotPlanDialogueAudioTakeByAssetId(session, assetId);
  if (!take) {
    return;
  }
  throw new ProjectDataError(
    'CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_INVALID',
    `Asset ${assetId} belongs to active Shot Plan Dialogue Audio Take ${take.id} and cannot be discarded directly.`,
    { suggestion: 'Discard the Shot Plan Dialogue Audio Take instead.' },
  );
}
