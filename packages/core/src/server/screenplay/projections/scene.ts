import type {
  Screenplay,
  ScreenplaySceneResource,
} from '../../../client/screenplay/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export function projectScreenplayScene(
  screenplay: Screenplay,
  sceneId: string,
): ScreenplaySceneResource {
  const scene = screenplay.scenes.find((value) => value.id === sceneId);
  if (!scene) {
    throw new ProjectDataError(
      'SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND',
      `Scene ${sceneId} does not exist.`,
    );
  }
  return {
    scene,
    references: screenplay.references.filter((reference) =>
      'sceneId' in reference.target && reference.target.sceneId === sceneId),
  };
}
