import type { Scene, Screenplay } from '../../../client/screenplay/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export function addScreenplayScene(screenplay: Screenplay, scene: Scene): void {
  if (screenplay.scenes.some((value) => value.id === scene.id)) {
    throw invalidScene(`Scene ${scene.id} already exists.`);
  }
  screenplay.scenes.push(scene);
}

export function updateScreenplayScene(screenplay: Screenplay, scene: Scene): void {
  const index = screenplay.scenes.findIndex((value) => value.id === scene.id);
  if (index < 0) {
    throw invalidScene(`Scene ${scene.id} does not exist.`);
  }
  screenplay.scenes[index] = scene;
}

export function deleteScreenplayScene(screenplay: Screenplay, sceneId: string): void {
  if (!screenplay.scenes.some((value) => value.id === sceneId)) {
    throw invalidScene(`Scene ${sceneId} does not exist.`);
  }
  screenplay.scenes = screenplay.scenes.filter((value) => value.id !== sceneId);
  screenplay.structure = screenplay.structure.filter(
    (entry) => entry.content.type !== 'scene' || entry.content.sceneId !== sceneId,
  );
  screenplay.references = screenplay.references.filter(
    (reference) => !('sceneId' in reference.target) || reference.target.sceneId !== sceneId,
  );
}

function invalidScene(message: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND',
    message,
    { suggestion: 'Use an existing Scene ID or a unique key for a new Scene.' },
  );
}
