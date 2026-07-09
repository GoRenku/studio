import type { MediaGenerationSpecRecord } from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { resolveProjectRelativePath } from '../../files/project-relative-paths.js';
import {
  resolveDurableDestinationOutputNames,
  resolveDurableDestinationRoot,
} from '../destinations/registry.js';
import { resolveTemporaryFileRoot } from '../temporary-files.js';
import type { ProjectAssetGenerationOutputPlacement } from '../types.js';
import { resolveGenerationOutputAllocation } from './registry.js';

export async function resolveProjectAssetGenerationOutput(input: {
  session: DatabaseSession;
  projectFolder: string;
  specRecord: MediaGenerationSpecRecord;
  outputCount: number;
}): Promise<ProjectAssetGenerationOutputPlacement> {
  const allocation = await resolveGenerationOutputAllocation(input);
  const projectRelativeRoot =
    allocation.kind === 'temporary'
      ? await resolveTemporaryFileRoot({
          session: input.session,
          projectFolder: input.projectFolder,
          destination: allocation.destination,
        })
      : await resolveDurableDestinationRoot({
          session: input.session,
          projectFolder: input.projectFolder,
          destination: allocation.destination,
          sourceProjectRelativePath: allocation.sourceProjectRelativePath,
          now: new Date().toISOString(),
        });
  const outputNames =
    allocation.kind === 'temporary'
      ? allocation.outputNames
      : await resolveDurableDestinationOutputNames({
          session: input.session,
          projectFolder: input.projectFolder,
          destination: allocation.destination,
          sourceProjectRelativePath: allocation.sourceProjectRelativePath,
          mediaKind: allocation.mediaKind,
          outputCount: input.outputCount,
          now: new Date().toISOString(),
          outputFormatHint: allocation.outputFormatHint,
        });
  return {
    projectRelativeRoot,
    absoluteRoot: resolveProjectRelativePath(input.projectFolder, projectRelativeRoot),
    outputNames,
    persistenceIntent:
      allocation.kind === 'temporary'
        ? { kind: 'temporary' }
        : { kind: 'durableAsset', destination: allocation.destination },
  };
}
