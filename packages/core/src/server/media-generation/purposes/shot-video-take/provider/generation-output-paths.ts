import type {
  RenkuConfigPathOptions,
} from '../../../../renku-config.js';
import path from 'node:path';
import {
  withShotProjectSession,
} from '../shared/project-session.js';
import type {
  SceneShotVideoTake,
} from '../../../../../client/index.js';
import {
  resolveShotVideoTakeFolder,
} from '../shared/take-media-paths.js';



export async function resolveShotGenerationOutputPaths(
  input: RenkuConfigPathOptions & { projectName?: string },
  context: { take: SceneShotVideoTake }
) {
  return withShotProjectSession(input, ({ session, projectFolder }) => {
    const projectRelativeRoot = resolveShotVideoTakeFolder({
      session,
      projectFolder,
      take: context.take,
      now: new Date().toISOString(),
    });
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}
