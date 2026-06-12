import type {
  Asset,
  LocationAzimuthViewId,
  ShotVideoTakeLocationViewReferenceChoice,
  ProjectRelativePath,
  ShotVideoTakeReferenceImagePreview,
  ShotVideoTakeGenerationContext,
  MediaGenerationDependencyLine,
  ShotVideoTakeGenerationPlan,
  MediaGenerationPlanLine,
  ShotVideoTakeReferenceCardPlan,
  ShotVideoTakeReferenceChoiceState,
} from '../../../client/index.js';
import {
  readAssetFileRecord,
} from '../../database/access/asset-files.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../../database/access/asset-relationships/index.js';
import {
  readLocationEnvironmentSheetByAssetId,
  listLocationEnvironmentSheetViews,
} from '../../database/access/location-environment-sheets.js';
import {
  listLookbookSheets,
} from '../../database/access/lookbook-sheets.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import {
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  ReferenceInclusionResolution,
  referenceInclusionForLine,
} from './reference-inclusions.js';



export function locationViewChoices(
  session: DatabaseSession,
  environmentSheet: Asset,
  selectedViewIds: LocationAzimuthViewId[]
): ShotVideoTakeLocationViewReferenceChoice[] {
  const sheet = readLocationEnvironmentSheetByAssetId(
    session,
    environmentSheet.assetId
  );
  if (!sheet) {
    return [];
  }
  const selectedViewIdSet = new Set(selectedViewIds);
  return listLocationEnvironmentSheetViews(session, sheet.id).map((view) => {
    const viewId = locationAzimuthViewId(
      requireLocationAzimuthDegrees(view.azimuthDegrees)
    );
    const assetFile = readAssetFileRecord(session, {
      assetId: sheet.assetId,
      assetFileId: view.assetFileId,
    });
    return {
      id: `${sheet.assetId}:${viewId}`,
      viewId,
      label: locationAzimuthViewLabel(viewId),
      selected: selectedViewIdSet.has(viewId),
      card: referenceCardPlan({
        selected: selectedViewIdSet.has(viewId),
        mediaKind: 'image',
        previews: assetFile
          ? [
              {
                assetId: sheet.assetId,
                assetFileId: assetFile.id,
                projectRelativePath:
                  assetFile.projectRelativePath as ProjectRelativePath,
                title: locationAzimuthViewLabel(viewId),
                alt: locationAzimuthViewLabel(viewId),
              },
            ]
          : [],
      }),
    };
  });
}



export function requireLocationAzimuthDegrees(value: number): 0 | 90 | 180 | 270 {
  if (value === 0 || value === 90 || value === 180 || value === 270) {
    return value;
  }
  throw new ProjectDataError(
    'PROJECT_DATA403',
    `Unsupported location environment sheet azimuth: ${value}.`,
    { suggestion: 'Regenerate the location environment sheet views.' }
  );
}



export function locationAzimuthViewId(
  azimuthDegrees: 0 | 90 | 180 | 270
): LocationAzimuthViewId {
  if (azimuthDegrees === 90) {
    return 'right';
  }
  if (azimuthDegrees === 180) {
    return 'back';
  }
  if (azimuthDegrees === 270) {
    return 'left';
  }
  return 'front';
}



export function locationAzimuthViewLabel(viewId: LocationAzimuthViewId): string {
  if (viewId === 'right') {
    return 'Right';
  }
  if (viewId === 'back') {
    return 'Back';
  }
  if (viewId === 'left') {
    return 'Left';
  }
  return 'Front';
}



export function assetsForTarget(
  session: DatabaseSession,
  input: {
    target: Parameters<typeof listAssetRelationshipPage>[1]['target'];
    role: string;
  }
): Asset[] {
  return listAssetRelationshipPage(session, {
    target: input.target,
    role: input.role,
    mediaKind: 'image',
    limit: MAX_RESOURCE_PAGE_LIMIT,
  }).items;
}



export function previewImagesForAsset(
  asset: Asset | null,
  title: string,
  alt: string
): ShotVideoTakeReferenceImagePreview[] {
  if (!asset) {
    return [];
  }
  const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
  return file
    ? [
        {
          assetId: asset.assetId,
          assetFileId: file.id,
          projectRelativePath: file.projectRelativePath,
          title,
          alt,
        },
      ]
    : [];
}



export function previewImagesForLookbookSheet(
  lookbookSheet: ReturnType<typeof listLookbookSheets>[number],
  title: string,
  alt: string
): ShotVideoTakeReferenceImagePreview[] {
  const file = lookbookSheet.asset.files.find(
    (candidate) => candidate.mediaKind === 'image'
  );
  return file
    ? [
        {
          assetId: lookbookSheet.asset.assetId,
          assetFileId: file.id,
          projectRelativePath: file.projectRelativePath,
          title,
          alt,
        },
      ]
    : [];
}



export function previewImagesForDependencyLine(
  context: ShotVideoTakeGenerationContext,
  line: MediaGenerationDependencyLine | null
): ShotVideoTakeReferenceImagePreview[] {
  if (!line?.selectedAsset) {
    return [];
  }
  const availableInput = context.availableInputs.find(
    (input) =>
      input.assetId === line.selectedAsset?.assetId &&
      input.assetFileId === line.selectedAsset?.assetFileId
  );
  return [
    {
      ...(availableInput ? { inputId: availableInput.inputId } : {}),
      assetId: line.selectedAsset.assetId,
      assetFileId: line.selectedAsset.assetFileId,
      projectRelativePath: line.selectedAsset.projectRelativePath,
      title: line.label,
      alt: line.label,
    },
  ];
}



export function dependencyLineById(
  plan: ShotVideoTakeGenerationPlan,
  dependencyId: string
): MediaGenerationDependencyLine | null {
  const lines = plan.dependencyInventory.dependencies.filter(
    (line) => line.dependencyId === dependencyId
  );
  return lines.find((line) => line.required) ?? lines[0] ?? null;
}



export function planLineForDependencyLine(
  plan: ShotVideoTakeGenerationPlan,
  line: MediaGenerationDependencyLine | null
): MediaGenerationPlanLine | null {
  if (!line) {
    return null;
  }
  return plan.lines.find((planLine) => planLine.dependencyLineId === line.id) ?? null;
}



export function referenceCardPlan(input: {
  selected: boolean;
  mediaKind: ShotVideoTakeReferenceCardPlan['mediaKind'];
  dependencyId?: string;
  line?: MediaGenerationDependencyLine | null;
  planLine?: MediaGenerationPlanLine | null;
  inclusion?: ReferenceInclusionResolution;
  previews?: ShotVideoTakeReferenceImagePreview[];
}): ShotVideoTakeReferenceCardPlan {
  const line = input.line ?? null;
  const planLine = input.planLine ?? null;
  const previews = input.previews ?? [];
  const inclusion =
    input.inclusion ??
    (input.dependencyId
      ? referenceInclusionForLine(input.dependencyId, line, input.selected)
      : null);
  if (input.selected && input.dependencyId && !line) {
    const diagnostic = createDiagnosticError(
      'CORE_SHOT_REFERENCE_DEPENDENCY_LINE_MISSING',
      `Selected reference has no dependency inventory line: ${input.dependencyId}.`,
      { path: ['references', input.dependencyId] },
      'Refresh the shot video dependency inventory before rendering selected references.'
    );
    return {
      state: 'unavailable',
      mediaKind: input.mediaKind,
      dependencyId: input.dependencyId,
      defaultIncluded: inclusion?.defaultIncluded ?? input.selected,
      included: inclusion?.included ?? input.selected,
      required: inclusion?.required ?? false,
      inclusionOverride: inclusion?.inclusionOverride ?? null,
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: diagnostic.message,
        overrideRequired: true,
      },
      previews,
      diagnostics: [diagnostic],
    };
  }
  if (
    input.selected &&
    input.dependencyId &&
    previews.length > 0 &&
    line?.availability.state === 'missing-generated'
  ) {
    const diagnostic = createDiagnosticError(
      'CORE_SHOT_REFERENCE_SELECTED_ASSET_NOT_IN_INVENTORY',
      `Selected reference has a concrete asset preview but the dependency inventory still marks it missing: ${input.dependencyId}.`,
      { path: ['references', input.dependencyId] },
      'Resolve the selected asset through the dependency inventory selector before rendering this reference as generated or planned.'
    );
    return {
      state: 'unavailable',
      mediaKind: input.mediaKind,
      dependencyId: input.dependencyId,
      dependencyLineId: line.id,
      ...(planLine ? { planLineId: planLine.id } : {}),
      defaultIncluded: inclusion?.defaultIncluded ?? input.selected,
      included: inclusion?.included ?? input.selected,
      required: inclusion?.required ?? line.required,
      inclusionOverride: inclusion?.inclusionOverride ?? null,
      purpose: line.purpose,
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: diagnostic.message,
        overrideRequired: true,
      },
      previews,
      diagnostics: [...line.diagnostics, diagnostic],
    };
  }
  return {
    state: referenceChoiceState({
      selected: input.selected,
      line,
      previews,
    }),
    mediaKind: input.mediaKind,
    ...(input.dependencyId ? { dependencyId: input.dependencyId } : {}),
    ...(line ? { dependencyLineId: line.id } : {}),
    ...(planLine ? { planLineId: planLine.id } : {}),
    defaultIncluded: inclusion?.defaultIncluded ?? input.selected,
    included: inclusion?.included ?? input.selected,
    required: inclusion?.required ?? line?.required ?? false,
    inclusionOverride: inclusion?.inclusionOverride ?? null,
    purpose: line?.purpose ?? null,
    pricing: line?.pricing ?? {
      state: 'not-applicable',
      estimatedUsd: null,
    },
    previews,
    diagnostics: line?.diagnostics ?? [],
  };
}



export function referenceChoiceState(input: {
  selected: boolean;
  line: MediaGenerationDependencyLine | null;
  previews: ShotVideoTakeReferenceImagePreview[];
}): ShotVideoTakeReferenceChoiceState {
  if (input.selected && input.line?.availability.state === 'satisfied') {
    return 'selected-ready';
  }
  if (input.selected && input.line?.availability.state === 'missing-generated') {
    return 'selected-planned';
  }
  if (input.selected) {
    return input.previews.length > 0 ? 'selected-ready' : 'unavailable';
  }
  return input.previews.length > 0 ? 'available' : 'not-selected';
}
