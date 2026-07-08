import { runGeneration } from '@gorenku/studio-engines';
import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  MediaGenerationRunReport,
} from '../../../client/index.js';
import {
  insertMediaGenerationRun,
  requireMediaGenerationRun,
} from '../../database/access/media-generation.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../entity-ids.js';
import type {
  RunMediaGenerationSpecInput,
  ReadMediaGenerationRunInput,
} from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import {
  mediaGenerationEstimateWithApproval,
  mediaGenerationRunApprovalToken,
  parseMediaGenerationRunCostApproval,
  requireMediaGenerationCostApproval,
} from '../cost/cost-approval.js';
import {
  estimateMediaGenerationSpecRecordCost,
} from '../cost/cost-projection.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';
import {
  prepareMediaGenerationSpec,
  readMediaGenerationSpec,
} from './spec-service.js';
import { withMediaGenerationProjectSession } from './project-session.js';

export async function runMediaGenerationSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readMediaGenerationSpec(input);
  if (specRecord.purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    return requireMediaGenerationPurposeDefinition(specRecord.purpose).runSpec(
      input
    ) as Promise<MediaGenerationRunReport>;
  }
  const prepared = await prepareMediaGenerationSpec(input);
  const estimate = await estimateMediaGenerationSpecRecordCost(prepared.spec);
  const mode = input.simulate ? 'simulated' : 'live';
  const costApproval = requireMediaGenerationCostApproval({
    mode,
    purpose: prepared.spec.purpose,
    estimate,
    approval: parseMediaGenerationRunCostApproval({
      approvalToken: input.approvalToken,
      approveUnpricedCost: input.approveUnpricedCost,
    }),
  });
  const outputPaths = await resolveSharedGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  const now = new Date().toISOString();
  const run = await withMediaGenerationProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    return insertMediaGenerationRun(session, {
      id: ids('media_generation_run'),
      specId: prepared.spec.id,
      spec: prepared.spec.spec,
      provider: prepared.generation.policy.provider,
      model: prepared.generation.policy.model,
      providerPayload: prepared.providerPayload,
      estimate: mediaGenerationEstimateWithApproval(estimate, costApproval),
      approvalToken: mediaGenerationRunApprovalToken(costApproval),
      simulated: Boolean(input.simulate),
      status: input.simulate ? 'simulated' : 'completed',
      outputs: result.outputs,
      diagnostics: result.diagnostics ?? {},
      startedAt: now,
      completedAt: now,
    });
  });
  return { run };
}

export async function readMediaGenerationRun(
  input: ReadMediaGenerationRunInput
): Promise<MediaGenerationRunReport> {
  if (!input.runId?.trim()) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_RUN_ID_REQUIRED',
      'Media generation run id is required.'
    );
  }
  return withMediaGenerationProjectSession(input, ({ session }) => ({
    run: requireMediaGenerationRun(session, input.runId),
  }));
}

async function resolveSharedGenerationOutputPaths(input: RenkuConfigPathOptions) {
  return withMediaGenerationProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
    return {
      absoluteRoot: `${projectFolder}/${projectRelativeRoot}`,
      projectRelativeRoot,
      projectFolder,
    };
  });
}
