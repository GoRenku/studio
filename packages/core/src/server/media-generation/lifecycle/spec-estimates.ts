import type {
  MediaGenerationEstimateReport,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import { requireMediaGenerationSpec } from '../../database/access/media-generation.js';
import type {
  ReadMediaGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import { estimateMediaGenerationSpecRecord } from '../cost/spec-estimates.js';
import { withMediaGenerationEstimationProjectSession } from './project-session.js';

export async function estimateMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const specRecord = await readMediaGenerationSpecForEstimation(input);
  return estimateMediaGenerationSpecRecord(specRecord, input);
}

async function readMediaGenerationSpecForEstimation(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withMediaGenerationEstimationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}
