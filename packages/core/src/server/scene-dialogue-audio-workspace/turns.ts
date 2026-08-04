import type { DialogueTurn, Screenplay } from '../../client/screenplay/index.js';
import { ProjectDataError } from '../project-data-error.js';

export interface SceneDialogueTurnContext {
  turn: DialogueTurn;
  castMemberId: string | null;
  plainText: string;
}

export function listSceneDialogueTurns(
  screenplay: Screenplay,
  sceneId: string,
): SceneDialogueTurnContext[] {
  const scene = screenplay.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_CONTEXT_NOT_FOUND',
      `Scene Dialogue Audio context was not found: ${sceneId}.`,
    );
  }
  return scene.blocks.flatMap((block) => {
    const turns = block.type === 'dialogue'
      ? [block]
      : block.type === 'dualDialogue'
        ? [block.left, block.right]
        : [];
    return turns.map((turn) => ({
      turn,
      castMemberId: speakerCastMemberId(screenplay, sceneId, turn.id),
      plainText: turn.parts
        .filter((part) => part.type === 'speech')
        .map((part) => part.text)
        .join('\n'),
    }));
  });
}

export function requireSceneDialogueTurn(
  screenplay: Screenplay,
  sceneId: string,
  turnId: string,
): SceneDialogueTurnContext {
  const context = listSceneDialogueTurns(screenplay, sceneId).find(
    (candidate) => candidate.turn.id === turnId,
  );
  if (!context) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Dialogue Turn was not found for Scene ${sceneId}: ${turnId}.`,
    );
  }
  return context;
}

function speakerCastMemberId(
  screenplay: Screenplay,
  sceneId: string,
  turnId: string,
): string | null {
  const speakers = screenplay.references.filter((reference) =>
    reference.role === 'speaker'
    && reference.target.type === 'dialogueCue'
    && reference.target.sceneId === sceneId
    && reference.target.turnId === turnId,
  );
  if (speakers.length > 1) {
    throw new ProjectDataError(
      'SCREENPLAY_REFERENCE_SPEAKER_DUPLICATE',
      `Dialogue Turn ${turnId} has more than one speaker reference.`,
    );
  }
  return speakers[0]?.subject.type === 'castMember' ? speakers[0].subject.id : null;
}
