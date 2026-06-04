import { estimateGeneration, runGeneration } from '@gorenku/studio-engines';
import type {
  MediaGenerationEstimateReport,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
} from '../../client/index.js';
import {
  insertMediaGenerationRun,
  requireMediaGenerationSpec,
} from '../database/access/media-generation.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ReadMediaGenerationSpecInput,
  RunMediaGenerationSpecInput,
} from '../project-data-service-contracts.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import {
  type CreateMediaGenerationSpecInput,
  type ListMediaGenerationSpecsInput,
  type MediaGenerationPurposeContextInput,
  type PrepareDraftMediaGenerationSpecInput,
  type UpdateMediaGenerationSpecInput,
  type ValidateMediaGenerationSpecInput,
  requireMediaGenerationPurposeDefinition,
} from './purpose-registry.js';

export async function buildMediaGenerationContext(
  input: MediaGenerationPurposeContextInput
) {
  return requireMediaGenerationPurposeDefinition(input.purpose).buildContext(input);
}

export async function listMediaGenerationModels(
  input: MediaGenerationPurposeContextInput
) {
  return requireMediaGenerationPurposeDefinition(input.purpose).listModels(input);
}

export async function validateMediaGenerationSpec(
  input: ValidateMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(input.spec.purpose).validateSpec(input);
}

export async function createMediaGenerationSpec(
  input: CreateMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(input.spec.purpose).createSpec(input);
}

export async function updateMediaGenerationSpec(
  input: UpdateMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(input.spec.purpose).updateSpec(input);
}

export async function readMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listMediaGenerationSpecs(
  input: ListMediaGenerationSpecsInput
) {
  return requireMediaGenerationPurposeDefinition(input.purpose).listSpecs(input);
}

export async function prepareMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
) {
  const specRecord = await readMediaGenerationSpec(input);
  return requireMediaGenerationPurposeDefinition(specRecord.purpose).prepareSpec(input);
}

export async function prepareDraftMediaGenerationSpec(
  input: PrepareDraftMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(input.spec.purpose).prepareDraftSpec(input);
}

export async function estimateMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareMediaGenerationSpec(input);
  const estimate = await estimateGeneration(prepared.generation);
  return { ...prepared, estimate };
}

export async function estimateDraftMediaGenerationSpec(
  input: PrepareDraftMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareDraftMediaGenerationSpec(input);
  const estimate = await estimateGeneration(prepared.generation);
  return { ...prepared, estimate };
}

export async function runMediaGenerationSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareMediaGenerationSpec(input);
  const estimate = await estimateGeneration(prepared.generation);
  if (
    estimate.estimatedCostUsd === null &&
    !input.simulate &&
    !input.allowUnpricedCost
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA390',
      `Media generation estimate is unpriced for ${prepared.spec.purpose}.`,
      {
        suggestion:
          'Approve an explicit unpriced-cost override before running this generation.',
      }
    );
  }
  const outputPaths = await resolveSharedGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: input.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  const now = new Date().toISOString();
  const run = await withMediaGenerationProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationRun(session, {
      id: ids('media_generation_run'),
      specId: prepared.spec.id,
      spec: prepared.spec.spec,
      provider: prepared.generation.policy.provider,
      model: prepared.generation.policy.model,
      providerPayload: prepared.providerPayload,
      estimate: {
        ...estimate,
        ...(estimate.estimatedCostUsd === null && input.allowUnpricedCost
          ? { unpricedCostOverride: true }
          : {}),
      },
      approvalToken: estimate.approvalToken,
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

async function withMediaGenerationProjectSession<T>(
  input: RenkuConfigPathOptions & { projectName?: string },
  fn: (handle: {
    projectFolder: string;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({ projectFolder: handle.projectFolder, session: handle.session });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({
      projectFolder: currentProject.projectFolder,
      session,
    })
  );
}
