import type {
  MediaGenerationEstimateReport,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import { requireMediaGenerationSpec } from '../../database/access/media-generation.js';
import type {
  ReadMediaGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import { draftMediaGenerationSpecRecord } from '../draft-generation.js';
import {
  type PrepareDraftMediaGenerationSpecInput,
  requireMediaGenerationPurposeDefinition,
} from '../purpose-registry.js';
import {
  type MediaGenerationEstimationPathOptions,
  withMediaGenerationEstimationProjectSession,
} from './project-session.js';

export async function estimateMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  return estimateMediaGenerationSpecRecord(
    await readMediaGenerationSpecForEstimation(input),
    input
  );
}

export async function estimateDraftMediaGenerationSpec(
  input: PrepareDraftMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  return estimateMediaGenerationSpecRecord(
    draftMediaGenerationSpecRecord(input.spec),
    input
  );
}

export async function estimateMediaGenerationSpecRecord(
  specRecord: MediaGenerationSpecRecord,
  input: MediaGenerationEstimationPathOptions = {}
): Promise<MediaGenerationEstimateReport> {
  const definition = requireMediaGenerationPurposeDefinition(specRecord.purpose);
  const projection = await definition.buildCostProjection({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: specRecord.spec,
  });
  return { spec: specRecord, estimate: projection.estimate };
}

async function readMediaGenerationSpecForEstimation(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withMediaGenerationEstimationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}
