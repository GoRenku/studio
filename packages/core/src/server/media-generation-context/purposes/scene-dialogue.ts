import { ProjectDataError } from '../../project-data-error.js';
import { readCastMemberResourceFromSession } from '../../resources/continuity-subjects.js';
import { readSceneDialogueAudioWorkspace } from '../../scene-dialogue-audio-workspace/context.js';
import { listSceneDialogueTurns } from '../../scene-dialogue-audio-workspace/turns.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';

export const buildSceneDialoguePurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'sceneDialogue') {
    throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Scene Dialogue Audio generation requires a Scene dialogue target.');
  }
  const target = input.target;
  const scene = input.screenplay.scenes.find((candidate) => candidate.id === target.sceneId);
  const turn = scene
    ? listSceneDialogueTurns(input.screenplay, scene.id)
      .find((candidate) => candidate.turn.id === target.turnId)
    : null;
  if (!scene || !turn) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
      `Media generation target dialogue turn was not found in Scene ${target.sceneId}: ${target.turnId}.`,
    );
  }
  const workspace = readSceneDialogueAudioWorkspace({ session: input.session, sceneId: scene.id });
  const dialogue = workspace.dialogues.find((candidate) => candidate.turnId === target.turnId)!;
  const speaker = dialogue.castMemberId
    ? readCastMemberResourceFromSession(input.session, dialogue.castMemberId).castMember
    : null;
  const setup = workspace.audioByTurnId[target.turnId] ?? null;
  return {
    targetContext: {
      kind: 'sceneDialogue',
      scene,
      turn: dialogue,
      speaker,
      castVoices: dialogue.castMemberId
        ? workspace.castVoicesByCastMemberId[dialogue.castMemberId] ?? []
        : [],
      setup,
      priorTakes: setup?.takes ?? [],
    },
    visualLanguage: [],
    suggestedReferences: [],
    resourceKeys: workspace.resourceKeys,
  };
};
