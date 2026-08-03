import type { DialogueTurn, Screenplay } from '../../client/screenplay/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneDialogueAudio } from '../schema/index.js';

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

export function assertDialogueAudioSpeakerBindings(
  session: DatabaseSession,
  screenplay: Screenplay,
): void {
  for (const audio of session.db.select().from(sceneDialogueAudio).all()) {
    const dialogue = requireSceneDialogueTurn(screenplay, audio.sceneId, audio.turnId);
    if (dialogue.castMemberId !== audio.castMemberId) {
      throw new ProjectDataError(
        'CORE_DIALOGUE_AUDIO_SPEAKER_REBIND_BLOCKED',
        `Dialogue Turn ${audio.turnId} cannot change speaker while Dialogue Audio depends on its current Cast Member.`,
        {
          suggestion: 'Discard or explicitly resolve the Dialogue Audio dependency before changing the speaker reference.',
        },
      );
    }
  }
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
