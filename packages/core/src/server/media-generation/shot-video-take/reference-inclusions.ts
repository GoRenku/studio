import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationDependencyLine,
  MediaGenerationDependencySlot,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputKind,
  ShotVideoTakePreflightInput,
  SceneShotWithLegacyShotSpecs,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { shotVideoInputDependencyId } from '../dependency-identifiers.js';



export interface ReferenceInclusionResolution {
  defaultIncluded: boolean;
  included: boolean;
  required: boolean;
  dependencyId: string;
  inclusionOverride: 'include' | 'exclude' | null;
}

export function validateRequiredReferenceInclusions(input: {
  context: ShotVideoTakeGenerationContext;
  slots: MediaGenerationDependencySlot[];
}): void {
  const issues = input.slots.flatMap((slot) => {
    const override = referenceInclusionOverride(
      input.context,
      slot.dependencyId
    );
    if (slot.required && override === 'exclude') {
      return [
        createDiagnosticError(
          'CORE_SHOT_REFERENCE_REQUIRED_EXCLUDED',
          `Required reference cannot be excluded: ${slot.label}.`,
          {
            path: ['shotSpecs', 'referenceInclusions', slot.dependencyId],
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
  context: ShotVideoTakeGenerationContext,
  slot: MediaGenerationDependencySlot
): boolean {
  if (slot.required) {
    return true;
  }
  const override = referenceInclusionOverride(context, slot.dependencyId);
  if (override === 'include') {
    return true;
  }
  if (override === 'exclude') {
    return false;
  }
  return slot.defaultIncluded ?? true;
}

export function filterPreparedInputsByReferenceInclusions(
  context: ShotVideoTakeGenerationContext,
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
    return referenceInclusionOverride(context, dependencyId) !== 'exclude';
  });
}

export function referenceInclusionOverride(
  context: ShotVideoTakeGenerationContext,
  dependencyId: string
): 'include' | 'exclude' | null {
  return groupReferenceInclusionOverride(
    context.shots.map(
      (shot) =>
        (shot as SceneShotWithLegacyShotSpecs).shotSpecs
          ?.referenceInclusions?.[dependencyId] ?? null
    )
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



export function referenceInclusionForDependencyId(
  context: ShotVideoTakeGenerationContext,
  dependencyId: string,
  defaultIncluded: boolean,
  line?: MediaGenerationDependencyLine | null
): ReferenceInclusionResolution {
  const required = line?.required ?? false;
  const inclusionOverride = referenceInclusionOverride(context, dependencyId);
  return {
    dependencyId,
    defaultIncluded,
    required,
    inclusionOverride,
    included: required
      ? true
      : inclusionOverride === 'include'
        ? true
        : inclusionOverride === 'exclude'
          ? false
          : defaultIncluded,
  };
}



export function requiredGeneralReferenceInclusion(input: {
  context: ShotVideoTakeGenerationContext;
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
  context: ShotVideoTakeGenerationContext,
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet'
): boolean {
  const inputModeId =
    context.take.production.inputModeId ?? context.defaults.inputModeId;
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
