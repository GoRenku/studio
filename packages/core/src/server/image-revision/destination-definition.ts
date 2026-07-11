import type {
  ImageRevisionRunReport,
  ImageRevisionTarget,
  MediaGenerationRun,
} from '../../client/index.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import type { ResolvedImageRevisionSource } from './source-context.js';

export interface ImageRevisionDestinationInput {
  projectName?: string;
  homeDir?: string;
  target: ImageRevisionTarget;
  source: ResolvedImageRevisionSource;
  run: MediaGenerationRun;
  outputProjectRelativePath: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ImageRevisionDestinationResult {
  imported: ImageRevisionRunReport['imported'];
  resourceKeys: string[];
}

export interface ImageRevisionDestinationDefinition<
  Kind extends ImageRevisionTarget['kind'] = ImageRevisionTarget['kind'],
> {
  kind: Kind;
  importResult(
    input: ImageRevisionDestinationInput & {
      target: Extract<ImageRevisionTarget, { kind: Kind }>;
    },
  ): Promise<ImageRevisionDestinationResult>;
}
