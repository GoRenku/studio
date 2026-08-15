import { createHash } from 'node:crypto';
import type {
  DialogueTurn,
  OpeningElement,
  Scene,
  Screenplay,
  ScreenplayBlock,
  ScreenplayReferenceTarget,
} from '../../../client/screenplay/index.js';
import type { ScreenplayImportCandidates } from './contracts.js';

export interface FdxContentIdentityResult {
  screenplay: Screenplay;
  candidates: ScreenplayImportCandidates;
}

export function fdxSceneContentHash(scene: Scene): string {
  return sha256(sceneContent(scene));
}

export function fdxFlatScreenplayContentHash(screenplay: Screenplay): string | null {
  if (!isFlatFdxScreenplay(screenplay)) {
    return null;
  }
  const sceneIndexById = new Map(screenplay.scenes.map((scene, index) => [scene.id, index]));
  return sha256({
    opening: screenplay.opening.map(blockContent),
    scenes: screenplay.scenes.map(sceneContent),
    structure: screenplay.structure.map((entry) => ({
      position: entry.position,
      sceneIndex: sceneIndexById.get(entry.content.type === 'scene' ? entry.content.sceneId : ''),
    })),
  });
}

export function retainCurrentFdxScreenplayWhenEqual(input: {
  current: Screenplay;
  proposed: Screenplay;
  candidates: ScreenplayImportCandidates;
}): FdxContentIdentityResult | null {
  const currentHash = fdxFlatScreenplayContentHash(input.current);
  const proposedHash = fdxFlatScreenplayContentHash(input.proposed);
  if (!currentHash || currentHash !== proposedHash) {
    return null;
  }
  const ids = new Map<string, string>();
  input.proposed.opening.forEach((block, index) => {
    mapEquivalentBlockIds(input.current.opening[index]!, block, ids);
  });
  input.proposed.scenes.forEach((scene, index) => {
    mapEquivalentSceneIds(input.current.scenes[index]!, scene, ids);
  });
  return {
    screenplay: structuredClone(input.current),
    candidates: replaceCandidateIds(input.candidates, ids),
  };
}

export function reuseUniqueUnchangedFdxScenes(input: {
  current: Screenplay;
  proposed: Screenplay;
  candidates: ScreenplayImportCandidates;
}): FdxContentIdentityResult {
  const screenplay = structuredClone(input.proposed);
  const currentByHash = uniqueScenesByHash(input.current.scenes);
  const proposedByHash = uniqueScenesByHash(screenplay.scenes);
  const ids = new Map<string, string>();

  screenplay.scenes = screenplay.scenes.map((proposedScene) => {
    const hash = fdxSceneContentHash(proposedScene);
    const currentScene = currentByHash.get(hash);
    if (!currentScene || proposedByHash.get(hash) !== proposedScene) {
      return proposedScene;
    }
    mapEquivalentSceneIds(currentScene, proposedScene, ids);
    return structuredClone(currentScene);
  });

  for (const entry of screenplay.structure) {
    if (entry.content.type === 'scene') {
      entry.content.sceneId = replaceId(entry.content.sceneId, ids);
    }
  }
  return {
    screenplay,
    candidates: replaceCandidateIds(input.candidates, ids),
  };
}

function isFlatFdxScreenplay(screenplay: Screenplay): boolean {
  return screenplay.sections.length === 0
    && screenplay.references.length === 0
    && screenplay.structure.length === screenplay.scenes.length
    && screenplay.structure.every((entry, index) =>
      entry.parentSectionId === undefined
      && entry.content.type === 'scene'
      && entry.content.sceneId === screenplay.scenes[index]?.id
      && entry.position === index
    );
}

function uniqueScenesByHash(scenes: Scene[]): Map<string, Scene> {
  const result = new Map<string, Scene>();
  const duplicates = new Set<string>();
  for (const scene of scenes) {
    const hash = fdxSceneContentHash(scene);
    if (result.has(hash)) {
      duplicates.add(hash);
    } else {
      result.set(hash, scene);
    }
  }
  for (const duplicate of duplicates) {
    result.delete(duplicate);
  }
  return result;
}

function sceneContent(scene: Scene): unknown {
  return {
    ...(scene.productionNumber !== undefined ? { productionNumber: scene.productionNumber } : {}),
    heading: scene.heading,
    ...(scene.title !== undefined ? { title: scene.title } : {}),
    blocks: scene.blocks.map(blockContent),
  };
}

function blockContent(block: OpeningElement | ScreenplayBlock): unknown {
  if (block.type === 'dialogue') {
    return {
      type: block.type,
      characterName: block.characterName,
      extensions: block.extensions,
      parts: block.parts.map((part) => ({ type: part.type, text: part.text })),
    };
  }
  if (block.type === 'dualDialogue') {
    return {
      type: block.type,
      left: turnContent(block.left),
      right: turnContent(block.right),
    };
  }
  return { type: block.type, text: block.text };
}

function turnContent(turn: DialogueTurn): unknown {
  return {
    characterName: turn.characterName,
    extensions: turn.extensions,
    parts: turn.parts.map((part) => ({ type: part.type, text: part.text })),
  };
}

function mapEquivalentSceneIds(
  current: Scene,
  proposed: Scene,
  ids: Map<string, string>,
): void {
  ids.set(proposed.id, current.id);
  proposed.blocks.forEach((block, index) => {
    mapEquivalentBlockIds(current.blocks[index]!, block, ids);
  });
}

function mapEquivalentBlockIds(
  current: OpeningElement | ScreenplayBlock,
  proposed: OpeningElement | ScreenplayBlock,
  ids: Map<string, string>,
): void {
  ids.set(proposed.id, current.id);
  if (current.type === 'dialogue' && proposed.type === 'dialogue') {
    mapEquivalentTurnIds(current, proposed, ids);
  }
  if (current.type === 'dualDialogue' && proposed.type === 'dualDialogue') {
    mapEquivalentTurnIds(current.left, proposed.left, ids);
    mapEquivalentTurnIds(current.right, proposed.right, ids);
  }
}

function mapEquivalentTurnIds(
  current: DialogueTurn,
  proposed: DialogueTurn,
  ids: Map<string, string>,
): void {
  ids.set(proposed.id, current.id);
  proposed.parts.forEach((part, index) => {
    ids.set(part.id, current.parts[index]!.id);
  });
}

function replaceCandidateIds(
  candidates: ScreenplayImportCandidates,
  ids: Map<string, string>,
): ScreenplayImportCandidates {
  return {
    characterCues: candidates.characterCues.map((candidate) => ({
      ...candidate,
      turnIds: candidate.turnIds.map((id) => replaceId(id, ids)),
    })),
    sceneHeadings: candidates.sceneHeadings.map((candidate) => ({
      ...candidate,
      sceneId: replaceId(candidate.sceneId, ids),
    })),
    taggedSubjects: candidates.taggedSubjects.map((candidate) => ({
      ...candidate,
      target: replaceTargetIds(candidate.target, ids),
    })),
  };
}

function replaceTargetIds(
  target: ScreenplayReferenceTarget,
  ids: Map<string, string>,
): ScreenplayReferenceTarget {
  switch (target.type) {
    case 'openingElement': return { ...target, elementId: replaceId(target.elementId, ids) };
    case 'scene':
    case 'sceneHeading': return { ...target, sceneId: replaceId(target.sceneId, ids) };
    case 'block': return {
      ...target,
      sceneId: replaceId(target.sceneId, ids),
      blockId: replaceId(target.blockId, ids),
    };
    case 'dialogueCue': return {
      ...target,
      sceneId: replaceId(target.sceneId, ids),
      turnId: replaceId(target.turnId, ids),
    };
    case 'dialoguePart': return {
      ...target,
      sceneId: replaceId(target.sceneId, ids),
      turnId: replaceId(target.turnId, ids),
      partId: replaceId(target.partId, ids),
    };
  }
}

function replaceId(value: string, ids: Map<string, string>): string {
  return ids.get(value) ?? value;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
