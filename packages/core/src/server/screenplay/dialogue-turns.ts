import type { DialogueTurn, Screenplay } from '../../client/screenplay/index.js';
import { ProjectDataError } from '../project-data-error.js';

export interface NumberedDialogueTurnContext {
  number: number;
  turn: DialogueTurn;
  castMemberId: string | null;
  plainText: string;
}

export function listNumberedDialogueTurns(
  screenplay: Screenplay,
  sceneId: string,
): NumberedDialogueTurnContext[] {
  const scene = screenplay.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_DIALOGUE_AUDIO_CONTEXT_NOT_FOUND',
      `Dialogue context was not found for Scene: ${sceneId}.`,
    );
  }
  return scene.blocks
    .flatMap((block) => block.type === 'dialogue'
      ? [block]
      : block.type === 'dualDialogue'
        ? [block.left, block.right]
        : [])
    .map((turn, index) => ({
      number: index + 1,
      turn,
      castMemberId: speakerCastMemberId(screenplay, sceneId, turn.id),
      plainText: turn.parts
        .filter((part) => part.type === 'speech')
        .map((part) => part.text)
        .join('\n'),
    }));
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
