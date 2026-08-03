import type { ScreenplaySceneResource } from '../../../client/screenplay/index.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';
import { projectScreenplayScene } from '../projections/scene.js';

export async function readScreenplayScene(
  input: RenkuConfigPathOptions & { projectName: string; sceneId: string },
): Promise<ScreenplaySceneResource> {
  const { session } = await openProjectSession(input);
  try {
    return projectScreenplayScene(readCanonicalScreenplay(session), input.sceneId);
  } finally {
    session.close();
  }
}
