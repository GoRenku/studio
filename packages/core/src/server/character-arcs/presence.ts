import type { CastMemberCharacterArcResource } from '../../client/character-arcs/model.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readReferenceRecords } from '../screenplay/persistence/references.js';

/**
 * Scenes where any of the given Cast Members appear, from screenplay
 * references: a speaker reference means they speak; any other reference means
 * they are present or mentioned.
 */
export function readCharacterArcPresence(
  session: DatabaseSession,
  castMemberIds: ReadonlySet<string>
): CastMemberCharacterArcResource['presence'] {
  const speaksByScene = new Map<string, boolean>();
  for (const reference of readReferenceRecords(session)) {
    if (reference.subject.type !== 'castMember' || !castMemberIds.has(reference.subject.id)) {
      continue;
    }
    if (reference.target.type === 'openingElement') {
      continue;
    }
    const sceneId = reference.target.sceneId;
    speaksByScene.set(sceneId, (speaksByScene.get(sceneId) ?? false) || reference.role === 'speaker');
  }
  return [...speaksByScene].map(([sceneId, speaks]) => ({ sceneId, speaks }));
}
