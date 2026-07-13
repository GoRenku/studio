import { and, eq, isNull } from 'drizzle-orm';
import type { SceneDialogueAudioWorkspaceMutationReport } from '../../client/scene-dialogue-audio-workspace.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneDialogueAudio, sceneDialogueAudioTakes } from '../schema/index.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { readSceneDialogueAudioWorkspace } from './context.js';

export function discardSceneDialogueAudioTake(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  dialogueId: string;
  takeId: string;
}): SceneDialogueAudioWorkspaceMutationReport {
  const take = input.session.db
    .select({ id: sceneDialogueAudioTakes.id })
    .from(sceneDialogueAudioTakes)
    .innerJoin(
      sceneDialogueAudio,
      eq(sceneDialogueAudio.id, sceneDialogueAudioTakes.sceneDialogueAudioId)
    )
    .where(
      and(
        eq(sceneDialogueAudioTakes.id, input.takeId),
        eq(sceneDialogueAudio.sceneId, input.sceneId),
        eq(sceneDialogueAudio.dialogueId, input.dialogueId),
        isNull(sceneDialogueAudioTakes.discardedAt)
      )
    )
    .get();
  const project = readProjectRecord(input.session);
  if (!take || !project) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_TAKE_NOT_FOUND',
      `Scene Dialogue Audio take was not found: ${input.takeId}.`
    );
  }
  const recovery = discardTrashObject({
    session: input.session,
    project,
    projectFolder: input.projectFolder,
    itemKind: 'sceneDialogueAudioTake',
    itemId: input.takeId,
    commandName: 'scene-dialogue-audio.take.discard',
    changes: [
      { type: 'sceneDialogueAudioTake.discarded', takeId: input.takeId },
    ],
  });
  const context = readSceneDialogueAudioWorkspace(input);
  return { context, recovery: recovery.recovery, resourceKeys: context.resourceKeys };
}
