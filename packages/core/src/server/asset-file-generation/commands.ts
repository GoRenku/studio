import type { AssetFileGenerationProvenance } from '../../client/index.js';
import {
  insertAssetFileGenerationRecord,
  readAssetFileGenerationRecord,
} from '../database/access/asset-file-generations.js';
import { readAssetFileRecordByIdIncludingDiscarded } from '../database/access/asset-files.js';
import { requireMediaGenerationRun } from '../database/access/media-generation.js';
import { withMediaGenerationProjectSession } from '../media-generation/lifecycle/project-session.js';
import { ProjectDataError } from '../project-data-error.js';
import { matchingMediaGenerationOutputs } from './output-match.js';
import type {
  CopyAssetFileGenerationProvenanceInput,
  RecordAssetFileGenerationProvenanceInput,
} from './types.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export async function recordAssetFileGenerationProvenance(
  input: RecordAssetFileGenerationProvenanceInput,
): Promise<AssetFileGenerationProvenance> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    recordAssetFileGenerationProvenanceInSession(session, input),
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
  const run = requireMediaGenerationRun(session, input.mediaGenerationRunId);
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

export async function copyAssetFileGenerationProvenance(
  input: CopyAssetFileGenerationProvenanceInput,
): Promise<AssetFileGenerationProvenance | null> {
  return withMediaGenerationProjectSession(input, ({ session }) => {
    const source = readAssetFileGenerationRecord(
      session,
      input.sourceAssetFileId,
    );
    if (!source) {
      return null;
    }
    const target = readAssetFileRecordByIdIncludingDiscarded(
      session,
      input.targetAssetFileId,
    );
    if (!target || target.discardedAt) {
      throw new ProjectDataError(
        'CORE_ASSET_FILE_GENERATION_PROVENANCE_MISSING',
        `Active target AssetFile was not found: ${input.targetAssetFileId}.`,
      );
    }
    const existing = readAssetFileGenerationRecord(session, target.id);
    if (existing) {
      if (
        existing.mediaGenerationRunId !== source.mediaGenerationRunId ||
        existing.outputArtifactId !== source.outputArtifactId
      ) {
        throw new ProjectDataError(
          'CORE_ASSET_FILE_GENERATION_PROVENANCE_CONFLICT',
          `Target AssetFile ${target.id} already has different generation provenance.`,
        );
      }
      return existing;
    }
    const record = {
      ...source,
      assetFileId: target.id,
      createdAt: new Date().toISOString(),
    };
    insertAssetFileGenerationRecord(session, record);
    return record;
  });
}
