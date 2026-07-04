import type {
  RenkuConfigPathOptions,
} from '../../../../renku-config.js';
import path from 'node:path';
import {
  withShotProjectSession,
} from '../shared/project-session.js';



export async function resolveShotGenerationOutputPaths(input: RenkuConfigPathOptions & { projectName?: string }) {
  return withShotProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}
