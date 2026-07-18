import type { AssetFileGenerationProvenance } from '../../client/index.js';
import {
  insertAssetFileGenerationRecord,
  readAssetFileGenerationRecord,
} from '../database/access/asset-file-generations.js';
import { readAssetFileRecordByIdIncludingDiscarded } from '../database/access/asset-files.js';
import { readGenerationRunRecord } from '../database/access/media-generation.js';
import { withProjectDatabaseSession } from '../database/lifecycle/project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { matchingMediaGenerationOutputs } from './output-match.js';
import type { RecordAssetFileGenerationProvenanceInput } from './types.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export async function recordAssetFileGenerationProvenance(
  input: RecordAssetFileGenerationProvenanceInput,
): Promise<AssetFileGenerationProvenance> {
  return withProjectDatabaseSession(input, (session) =>
    recordAssetFileGenerationProvenanceInSession(session, input)
  );
}

export function recordAssetFileGenerationProvenanceInSession(
  session: DatabaseSession,
  input: Omit<RecordAssetFileGenerationProvenanceInput, 'projectName' | 'homeDir'>,
): AssetFileGenerationProvenance {
  const file = readAssetFileRecordByIdIncludingDiscarded(
    session,
    input.assetFileId,
  );
  if (!file || file.discardedAt) {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_PROVENANCE_MISSING',
      `Active AssetFile was not found: ${input.assetFileId}.`,
    );
  }
  const run = readGenerationRunRecord(session, input.mediaGenerationRunId);
  if (!run) {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_PROVENANCE_MISSING',
      `Generation run was not found: ${input.mediaGenerationRunId}.`
    );
  }
  if (run.status !== 'completed' && run.status !== 'simulated') {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_OUTPUT_MISMATCH',
      `Media Generation Run ${run.id} has no successful output.`,
    );
  }
  const matches = matchingMediaGenerationOutputs(run, file).filter(
    (output) =>
      !input.outputArtifactId ||
      output.artifactId === input.outputArtifactId,
  );
  if (matches.length !== 1) {
    throw new ProjectDataError(
      'CORE_ASSET_FILE_GENERATION_OUTPUT_MISMATCH',
      `AssetFile ${file.id} does not match exactly one output from Media Generation Run ${run.id}.`,
      {
        suggestion:
          'Record provenance only after the generated output has been imported and its content hash is available.',
      },
    );
  }
  const existing = readAssetFileGenerationRecord(session, file.id);
  const outputArtifactId = matches[0]?.artifactId ?? null;
  if (existing) {
    if (
      existing.mediaGenerationRunId !== run.id ||
      existing.outputArtifactId !== outputArtifactId
    ) {
      throw new ProjectDataError(
        'CORE_ASSET_FILE_GENERATION_PROVENANCE_CONFLICT',
        `AssetFile ${file.id} already has different generation provenance.`,
      );
    }
    return existing;
  }
  const record = {
    assetFileId: file.id,
    mediaGenerationRunId: run.id,
    outputArtifactId,
    createdAt: new Date().toISOString(),
  };
  insertAssetFileGenerationRecord(session, record);
  return record;
}
