import { ProjectDataError } from '../../project-data-error.js';
import { readCastMemberResourceFromSession } from '../../resources/continuity-subjects.js';
import { readSceneDialogueAudioWorkspace } from '../../scene-dialogue-audio-workspace/context.js';
import { listSceneDialogueTurns } from '../../scene-dialogue-audio-workspace/turns.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';

export const buildSceneDialoguePurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'sceneDialogue') {
    throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Scene Dialogue Audio generation requires a Scene dialogue target.');
  }
  const matches = input.screenplay.scenes.flatMap((scene) =>
    listSceneDialogueTurns(input.screenplay, scene.id)
      .filter((turn) => turn.turn.id === input.target.id)
      .map((turn) => ({ scene, turn }))
  );
  if (matches.length !== 1) {
    throw new ProjectDataError('CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND', `Media generation target dialogue turn was not found: ${input.target.id}.`);
  }
  const match = matches[0]!;
  const workspace = readSceneDialogueAudioWorkspace({ session: input.session, sceneId: match.scene.id });
  const dialogue = workspace.dialogues.find((candidate) => candidate.turnId === input.target.id)!;
  const speaker = dialogue.castMemberId
    ? readCastMemberResourceFromSession(input.session, dialogue.castMemberId).castMember
    : null;
  const setup = workspace.audioByTurnId[input.target.id] ?? null;
  return {
    targetContext: {
      kind: 'sceneDialogue',
      scene: match.scene,
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
