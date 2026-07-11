import type { ProjectIdGenerator } from '../entity-ids.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export interface ReadAssetFileGenerationProvenanceInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  assetFileId: string;
}

export interface RecordAssetFileGenerationProvenanceInput
  extends ReadAssetFileGenerationProvenanceInput {
  mediaGenerationRunId: string;
  outputArtifactId?: string | null;
  idGenerator?: ProjectIdGenerator;
}

export interface CopyAssetFileGenerationProvenanceInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  sourceAssetFileId: string;
  targetAssetFileId: string;
}
