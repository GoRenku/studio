import { and, eq, isNull } from 'drizzle-orm';
import type { SceneDialogueAudioWorkspaceMutationReport } from '../../client/scene-dialogue-audio-workspace.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  sceneDialogueAudio,
  sceneDialogueAudioTakeSelections,
  sceneDialogueAudioTakes,
} from '../schema/index.js';
import { readSceneDialogueAudioWorkspace } from './context.js';

export function selectSceneDialogueAudioTake(input: {
  session: DatabaseSession;
  sceneId: string;
  turnId: string;
  takeId: string;
  now: string;
}): SceneDialogueAudioWorkspaceMutationReport {
  const take = input.session.db
    .select({
      sceneDialogueAudioId: sceneDialogueAudio.id,
      takeId: sceneDialogueAudioTakes.id,
    })
    .from(sceneDialogueAudioTakes)
    .innerJoin(
      sceneDialogueAudio,
      eq(sceneDialogueAudio.id, sceneDialogueAudioTakes.sceneDialogueAudioId),
    )
    .where(and(
      eq(sceneDialogueAudio.sceneId, input.sceneId),
      eq(sceneDialogueAudio.turnId, input.turnId),
      eq(sceneDialogueAudioTakes.id, input.takeId),
      isNull(sceneDialogueAudioTakes.discardedAt),
    ))
    .get();
  if (!take) {
    throw takeInvalid(input.takeId);
  }
  input.session.db
    .insert(sceneDialogueAudioTakeSelections)
    .values({
      sceneDialogueAudioId: take.sceneDialogueAudioId,
      takeId: take.takeId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: sceneDialogueAudioTakeSelections.sceneDialogueAudioId,
      set: { takeId: take.takeId, updatedAt: input.now },
    })
    .run();
  return mutationReport(input);
}

export function clearSceneDialogueAudioTakeSelection(input: {
  session: DatabaseSession;
  sceneId: string;
  turnId: string;
}): SceneDialogueAudioWorkspaceMutationReport {
  const audio = input.session.db
    .select({ id: sceneDialogueAudio.id })
    .from(sceneDialogueAudio)
    .where(and(
      eq(sceneDialogueAudio.sceneId, input.sceneId),
      eq(sceneDialogueAudio.turnId, input.turnId),
    ))
    .get();
  if (!audio) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_CONTEXT_NOT_FOUND',
      `Scene Dialogue Audio context was not found for Dialogue Turn: ${input.turnId}.`,
    );
  }
  input.session.db
    .delete(sceneDialogueAudioTakeSelections)
    .where(eq(sceneDialogueAudioTakeSelections.sceneDialogueAudioId, audio.id))
    .run();
  return mutationReport(input);
}

function mutationReport(input: {
  session: DatabaseSession;
  sceneId: string;
}): SceneDialogueAudioWorkspaceMutationReport {
  const context = readSceneDialogueAudioWorkspace(input);
  return { context, resourceKeys: context.resourceKeys };
}

function takeInvalid(takeId: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_DIALOGUE_AUDIO_TAKE_INVALID',
    `Active Scene Dialogue Audio Take does not belong to the requested Dialogue Turn: ${takeId}.`,
  );
}
