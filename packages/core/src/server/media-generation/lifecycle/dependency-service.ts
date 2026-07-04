import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationDependencyPlan,
  MediaGenerationSpec,
} from '../../../client/index.js';
import type {
  PlanMediaGenerationDependenciesInput,
} from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  planMediaGenerationDependencyInventory,
} from '../dependencies/dependency-inventory.js';
import {
  planLinesFromDependencyInventory,
} from '../dependencies/dependency-inventory-lines.js';
import {
  resolveMediaGenerationDependencySelection,
} from '../dependencies/dependency-selectors.js';
import {
  mediaGenerationCostEstimateToPricing,
} from '../cost/cost-projection.js';
import {
  estimateDraftMediaGenerationSpec,
} from '../cost/spec-estimates.js';
import {
  type MediaGenerationDependencyDeclarationInput,
  requireMediaGenerationPurposeDefinition,
} from './purpose-lifecycle-registry.js';
import { withMediaGenerationProjectSession } from './project-session.js';

export async function planMediaGenerationDependencies(
  input: PlanMediaGenerationDependenciesInput
): Promise<MediaGenerationDependencyPlan> {
  const normalized = await requireMediaGenerationPurposeDefinition(
    input.spec.purpose
  ).validateSpec(input);
  const definition = requireMediaGenerationPurposeDefinition(
    normalized.spec.purpose
  );
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

export async function assertRootDependenciesResolved(input: {
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

function mediaGenerationPurposeLabel(purpose: string): string {
  return purpose
    .split('.')
    .map((part) => part.replace(/-/g, ' '))
    .join(' ');
}
