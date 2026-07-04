import type {
  MediaGenerationEstimateReport,
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import { draftMediaGenerationSpecRecord } from './draft-generation.js';
import { requireMediaGenerationPurposeCostDefinition } from './purpose-cost-registry.js';

export async function estimateDraftMediaGenerationSpec(
  input: EstimateDraftMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  return estimateMediaGenerationSpecRecord(
    draftMediaGenerationSpecRecord(input.spec),
    input
  );
}

export interface EstimateDraftMediaGenerationSpecInput
  extends MediaGenerationCostPathOptions {
  spec: MediaGenerationSpec;
}

export interface MediaGenerationCostPathOptions {
  projectName?: string;
  homeDir?: string;
}

export async function estimateMediaGenerationSpecRecord(
  specRecord: MediaGenerationSpecRecord,
  input: MediaGenerationCostPathOptions = {}
): Promise<MediaGenerationEstimateReport> {
  const definition = requireMediaGenerationPurposeCostDefinition(
    specRecord.purpose
  );
  const projection = await definition.buildCostProjection({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: specRecord.spec,
  });
  return { spec: specRecord, estimate: projection.estimate };
}
