import { runGeneration } from '@gorenku/studio-engines';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../client/index.js';
import type {
  AgentMediaReport,
  MediaGenerationDependencyPlan,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  MediaGenerationSpec,
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
import { readAgentMediaExecutionPolicy } from '../renku-config.js';
import {
  type AgentAwareMediaGenerationContextReport,
  type AgentAwareMediaGenerationModelListReport,
  type CreateMediaGenerationSpecInput,
  type ListMediaGenerationSpecsInput,
  type MediaGenerationPurposeContextInput,
  type MediaGenerationDependencyDeclarationInput,
  type PrepareDraftMediaGenerationSpecInput,
  type UpdateMediaGenerationSpecInput,
  type ValidateMediaGenerationSpecInput,
  requireMediaGenerationPurposeDefinition,
} from './purpose-registry.js';
import type { PlanMediaGenerationDependenciesInput } from '../project-data-service-contracts.js';
import { planMediaGenerationDependencyInventory } from './dependency-inventory.js';
import { resolveMediaGenerationDependencySelection } from './dependency-selectors.js';
import { planLinesFromDependencyInventory } from './dependency-inventory-lines.js';
import {
  estimateMediaGenerationSpecRecordCost,
  mediaGenerationCostEstimateToPricing,
} from './estimation/cost-projection.js';
import {
  estimateDraftMediaGenerationSpec,
} from './estimation/spec-estimates.js';

export async function buildMediaGenerationContext(
  input: MediaGenerationPurposeContextInput
): Promise<AgentAwareMediaGenerationContextReport> {
  const definition = requireMediaGenerationPurposeDefinition(input.purpose);
  const context = await definition.buildContext(input);
  return decorateAgentMediaReport({
    report: context,
    input,
    mediaKind: definition.mediaKind,
  });
}

export async function listMediaGenerationModels(
  input: MediaGenerationPurposeContextInput
): Promise<AgentAwareMediaGenerationModelListReport> {
  const definition = requireMediaGenerationPurposeDefinition(input.purpose);
  const report = await definition.listModels(input);
  return decorateAgentMediaReport({
    report,
    input,
    mediaKind: definition.mediaKind,
  });
}

export async function buildAgentMediaReport(input: {
  homeDir?: string;
  mediaKind: 'image' | 'audio' | 'video' | 'text' | 'json';
  renkuManagedAvailable?: boolean;
}): Promise<AgentMediaReport> {
  const policy = await readAgentMediaExecutionPolicy({
    homeDir: input.homeDir,
  });
  const appliesToPurpose = input.mediaKind === 'image';
  return {
    imageGeneration: {
      defaultExecutionPath: policy.imageGeneration.defaultExecutionPath,
      appliesToPurpose,
      renkuManagedAvailable:
        appliesToPurpose && (input.renkuManagedAvailable ?? true),
      externalBuiltInGeneration: {
        preferred: appliesToPurpose ? 'codex.gpt-image-2' : null,
        availableInRenku: false,
        requiresHarnessTool: true,
      },
    },
  };
}

async function decorateAgentMediaReport<
  Report extends object,
>(input: {
  report: Report;
  input: RenkuConfigPathOptions;
  mediaKind: 'image' | 'audio' | 'video' | 'text' | 'json';
}): Promise<Report & { agentMedia?: AgentMediaReport }> {
  if (input.mediaKind !== 'image') {
    return input.report;
  }
  return {
    ...input.report,
    agentMedia: await buildAgentMediaReport({
      homeDir: input.input.homeDir,
      mediaKind: input.mediaKind,
      renkuManagedAvailable: true,
    }),
  } as Report & { agentMedia?: AgentMediaReport };
}

export async function validateMediaGenerationSpec(
  input: ValidateMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(input.spec.purpose).validateSpec(input);
}

export async function createMediaGenerationSpec(
  input: CreateMediaGenerationSpecInput
) {
  const definition = requireMediaGenerationPurposeDefinition(input.spec.purpose);
  if (definition.declareDependencies) {
    await assertRootDependenciesResolved(input);
  }
  return definition.createSpec(input);
}

export async function updateMediaGenerationSpec(
  input: UpdateMediaGenerationSpecInput
) {
  const definition = requireMediaGenerationPurposeDefinition(input.spec.purpose);
  if (definition.declareDependencies) {
    await assertRootDependenciesResolved(input);
  }
  return definition.updateSpec(input);
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

export async function planMediaGenerationDependencies(
  input: PlanMediaGenerationDependenciesInput
): Promise<MediaGenerationDependencyPlan> {
  const normalized = await validateMediaGenerationSpec(input);
  const definition = requireMediaGenerationPurposeDefinition(normalized.spec.purpose);
  const target = normalized.spec.target;
  const request = {
    kind: 'media-generation-spec',
    spec: normalized.spec,
  };
  const declarationInput = {
    projectName: input.projectName,
    homeDir: input.homeDir,
    rootPurpose: normalized.spec.purpose,
    purpose: normalized.spec.purpose,
    target,
    request,
  } satisfies MediaGenerationDependencyDeclarationInput;
  const slots = definition.declareDependencies
    ? await definition.declareDependencies(declarationInput)
    : [];
  const inventory = await withMediaGenerationProjectSession(input, ({ session }) =>
    planMediaGenerationDependencyInventory({
      projectName: input.projectName,
      homeDir: input.homeDir,
      rootPurpose: normalized.spec.purpose,
      rootTarget: target,
      rootLineId: `root:${normalized.spec.purpose}`,
      rootLabel: mediaGenerationPurposeLabel(normalized.spec.purpose),
      rootMediaKind: definition.mediaKind,
      request,
      slots,
      diagnostics: [],
      resolveSelection: async (slot) =>
        resolveMediaGenerationDependencySelection({ request, session, slot }),
      declareDependencies: async ({ purpose, lineId, slot }) => {
        const childDefinition = requireMediaGenerationPurposeDefinition(purpose);
        if (!childDefinition.declareDependencies || !slot.dependencyTarget) {
          return [];
        }
        return childDefinition.declareDependencies({
          projectName: input.projectName,
          homeDir: input.homeDir,
          rootPurpose: normalized.spec.purpose,
          purpose,
          target: slot.dependencyTarget,
          request,
          parentLineId: lineId,
        });
      },
      estimateRoot: async () => {
        const estimate = await estimateDraftMediaGenerationSpec({
          projectName: input.projectName,
          homeDir: input.homeDir,
          spec: normalized.spec,
        });
        return {
          pricing: mediaGenerationCostEstimateToPricing(estimate.estimate),
          diagnostics: [],
          estimate: estimate.estimate,
        };
      },
    })
  );
  const lines = planLinesFromDependencyInventory(inventory.dependencyInventory);
  return {
    rootPurpose: normalized.spec.purpose,
    target,
    dependencyInventory: inventory.dependencyInventory,
    lines,
    estimate: inventory.dependencyInventory.estimate,
    finalEstimate: inventory.rootEstimate,
    diagnostics: inventory.dependencyInventory.diagnostics,
  };
}

async function assertRootDependenciesResolved(input: {
  projectName?: string;
  homeDir?: string;
  spec: MediaGenerationSpec;
}): Promise<void> {
  const plan = await planMediaGenerationDependencies(input);
  const unresolved = plan.dependencyInventory.dependencies.filter(
    (line) =>
      line.required &&
      (line.availability.state === 'missing-generated' ||
        line.availability.state === 'missing-manual' ||
        line.availability.state === 'invalid-selection')
  );
  if (unresolved.length === 0) {
    return;
  }
  const issues = unresolved.flatMap((line) =>
    line.diagnostics.length > 0
      ? line.diagnostics
      : [
          createDiagnosticError(
            'CORE_MEDIA_DEPENDENCY_UNRESOLVED_REQUIRED_DEPENDENCY',
            `Required media generation dependency is not yet an imported asset: ${line.label}.`,
            { path: ['dependencyInventory', 'dependencies', line.id] },
            'Generate or import this dependency, then create the root generation spec.'
          ),
        ]
  );
  throw new ProjectDataError(
    'CORE_MEDIA_DEPENDENCY_UNRESOLVED_REQUIRED_DEPENDENCIES',
    `Media generation spec has unresolved required dependencies: ${unresolved
      .map((line) => line.label)
      .join(', ')}.`,
    {
      issues,
      suggestion:
        'Generate or import the required dependencies, refresh the inventory, then create the root generation spec.',
    }
  );
}

export async function runMediaGenerationSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readMediaGenerationSpec(input);
  if (specRecord.purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    return requireMediaGenerationPurposeDefinition(specRecord.purpose).runSpec(input) as Promise<MediaGenerationRunReport>;
  }
  const prepared = await prepareMediaGenerationSpec(input);
  const estimate = await estimateMediaGenerationSpecRecordCost(prepared.spec);
  if (estimate.state === 'missing-pricing-input' && !input.simulate) {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_INPUT_MISSING',
      `Media generation cost estimate is missing pricing inputs for ${prepared.spec.purpose}: ${estimate.missingInputs.join(', ')}.`,
      {
        suggestion:
          'Complete the pricing fields for this generation setup before running it.',
      }
    );
  }
  if (
    estimate.state === 'unpriced' &&
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
  if (
    estimate.state === 'priced' &&
    !input.simulate &&
    input.approvalToken !== estimate.costApprovalToken
  ) {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_APPROVAL_TOKEN_MISMATCH',
      `Media generation run requires the current cost approval token for ${prepared.spec.purpose}.`,
      {
        suggestion:
          'Run the estimate command again and pass its cost approval token to the run command.',
      }
    );
  }
  const outputPaths = await resolveSharedGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken:
      estimate.state === 'priced'
        ? estimate.costApprovalToken
        : input.approvalToken ?? 'unpriced-cost-override',
    allowUnpricedCost: Boolean(input.allowUnpricedCost),
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
        ...(estimate.state === 'unpriced' && input.allowUnpricedCost
          ? { unpricedCostOverride: true }
          : {}),
      },
      approvalToken:
        estimate.state === 'priced'
          ? estimate.costApprovalToken
          : input.approvalToken,
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

function mediaGenerationPurposeLabel(purpose: string): string {
  return purpose
    .split('.')
    .map((part) => part.replace(/-/g, ' '))
    .join(' ');
}
