import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationDependencyLine,
  MediaGenerationDependencySlot,
  SceneShotVideoTakeDirection,
  ShotVideoTakeProductionContext,
  ShotVideoTakeInputKind,
  ShotVideoTakePreflightInput,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { shotVideoInputDependencyId } from '../dependency-identifiers.js';
import {
  sceneShotVideoTakeDirectionReferenceSelections,
  sceneShotVideoTakeGenerationDirections,
} from './take-state.js';



export interface ReferenceInclusionResolution {
  defaultIncluded: boolean;
  included: boolean;
  required: boolean;
  dependencyId: string;
  inclusionOverride: 'include' | 'exclude' | null;
}

export function validateRequiredReferenceInclusions(input: {
  context: ShotVideoTakeProductionContext;
  slots: MediaGenerationDependencySlot[];
}): void {
  const issues = input.slots.flatMap((slot) => {
    const override = generationReferenceInclusionOverride(
      input.context,
      slot.dependencyId
    );
    if (slot.required && override === 'exclude') {
      return [
        createDiagnosticError(
          'CORE_SHOT_REFERENCE_REQUIRED_EXCLUDED',
          `Required reference cannot be excluded: ${slot.label}.`,
          {
            path: ['take', 'state', 'structure', 'dependencyInclusions', slot.dependencyId],
            context: `dependencyId=${slot.dependencyId}`,
          },
          'Clear the exclusion or choose a generation route where this reference is optional.'
        ),
      ];
    }
    return [];
  });
  if (issues.length > 0) {
    throw new ProjectDataError(
      'CORE_SHOT_REFERENCE_REQUIRED_EXCLUDED',
      'Required shot reference inclusion overrides are invalid.',
      {
        issues,
        suggestion:
          'Clear required-reference exclusions before planning or generating the shot video take.',
      }
    );
  }
}

export function referenceDependencySlotIncluded(
  context: ShotVideoTakeProductionContext,
  slot: MediaGenerationDependencySlot
): boolean {
  if (slot.required) {
    return true;
  }
  const override = generationReferenceInclusionOverride(context, slot.dependencyId);
  if (override === 'include') {
    return true;
  }
  if (override === 'exclude') {
    return false;
  }
  return slot.defaultIncluded ?? true;
}

export function filterPreparedInputsByReferenceInclusions(
  context: ShotVideoTakeProductionContext,
  preparedInputs: ShotVideoTakePreflightInput[]
): ShotVideoTakePreflightInput[] {
  return preparedInputs.filter((preparedInput) => {
    if (!isReferencePreparedInput(preparedInput.kind)) {
      return true;
    }
    const dependencyId = shotVideoInputDependencyId({
      kind: preparedInput.kind,
      target: context.target,
      subjectKind: preparedInput.subjectKind,
      subjectId: preparedInput.subjectId,
    });
    return generationReferenceInclusionOverride(context, dependencyId) !== 'exclude';
  });
}

export function generationReferenceInclusionOverride(
  context: ShotVideoTakeProductionContext,
  dependencyId: string
): 'include' | 'exclude' | null {
  return groupReferenceInclusionOverride(
    sceneShotVideoTakeGenerationDirections({
      structure: context.take.state.structure,
      shotIds: context.take.shotIds,
    }).map(
      (direction) =>
        sceneShotVideoTakeDirectionReferenceSelections(direction)
          .dependencyInclusions[dependencyId] ?? null
    )
  );
}

export function editorReferenceInclusionOverride(
  direction: SceneShotVideoTakeDirection,
  dependencyId: string
): 'include' | 'exclude' | null {
  return (
    sceneShotVideoTakeDirectionReferenceSelections(direction)
      .dependencyInclusions[dependencyId] ?? null
  );
}

export function groupReferenceInclusionOverride(
  inclusions: Array<'include' | 'exclude' | null>
): 'include' | 'exclude' | null {
  if (inclusions.includes('exclude')) {
    return 'exclude';
  }
  if (inclusions.includes('include')) {
    return 'include';
  }
  return null;
}

export function isReferencePreparedInput(kind: ShotVideoTakeInputKind): boolean {
  return (
    kind === 'first-frame' ||
    kind === 'last-frame' ||
    kind === 'reference-image' ||
    kind === 'character-sheet' ||
    kind === 'location-sheet' ||
    kind === 'lookbook-sheet' ||
    kind === 'multi-shot-storyboard-sheet' ||
    kind === 'audio'
  );
}



export function generationReferenceInclusionForDependencyId(
  context: ShotVideoTakeProductionContext,
  dependencyId: string,
  defaultIncluded: boolean,
  line?: MediaGenerationDependencyLine | null
): ReferenceInclusionResolution {
  const required = line?.required ?? false;
  const inclusionOverride = generationReferenceInclusionOverride(context, dependencyId);
  return referenceInclusionResolution({
    dependencyId,
    defaultIncluded,
    required,
    inclusionOverride,
  });
}

export function editorReferenceInclusionForDependencyId(
  direction: SceneShotVideoTakeDirection,
  dependencyId: string,
  defaultIncluded: boolean,
  line?: MediaGenerationDependencyLine | null
): ReferenceInclusionResolution {
  const required = line?.required ?? false;
  const inclusionOverride = editorReferenceInclusionOverride(direction, dependencyId);
  return referenceInclusionResolution({
    dependencyId,
    defaultIncluded,
    required,
    inclusionOverride,
  });
}

function referenceInclusionResolution(input: {
  dependencyId: string;
  defaultIncluded: boolean;
  required: boolean;
  inclusionOverride: 'include' | 'exclude' | null;
}): ReferenceInclusionResolution {
  return {
    dependencyId: input.dependencyId,
    defaultIncluded: input.defaultIncluded,
    required: input.required,
    inclusionOverride: input.inclusionOverride,
    included: input.required
      ? true
      : input.inclusionOverride === 'include'
        ? true
        : input.inclusionOverride === 'exclude'
          ? false
          : input.defaultIncluded,
  };
}



export function requiredGeneralReferenceInclusion(input: {
  context: ShotVideoTakeProductionContext;
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet';
  selected: boolean;
  inclusion: ReferenceInclusionResolution;
}): ReferenceInclusionResolution {
  if (!input.selected || !routeRequiresGeneralReference(input.context, input.kind)) {
    return input.inclusion;
  }
  return {
    ...input.inclusion,
    required: true,
    included: true,
  };
}



export function routeRequiresGeneralReference(
  context: ShotVideoTakeProductionContext,
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet'
): boolean {
  const inputModeId =
    context.take.state.production.inputModeId ?? context.defaults.inputModeId;
  if (kind === 'first-frame') {
    return inputModeId === 'first-frame' || inputModeId === 'first-last-frame';
  }
  if (kind === 'last-frame') {
    return inputModeId === 'first-last-frame';
  }
  return false;
}



export function referenceInclusionForLine(
  dependencyId: string,
  line: MediaGenerationDependencyLine | null,
  defaultIncluded: boolean
): ReferenceInclusionResolution {
  return {
    dependencyId,
    defaultIncluded,
    included: line?.required ? true : defaultIncluded,
    required: line?.required ?? false,
    inclusionOverride: null,
  };
}
