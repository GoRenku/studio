import type {
  RenkuConfigPathOptions,
} from '../../../../renku-config.js';
import path from 'node:path';
import {
  requireScreenplayDocument,
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
    const screenplay = requireScreenplayDocument(session);
    const projectRelativeRoot = resolveShotVideoTakeFolder({
      session,
      screenplay,
      take: context.take,
    });
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}
