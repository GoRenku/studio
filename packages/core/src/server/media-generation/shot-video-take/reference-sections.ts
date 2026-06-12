import {
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  Asset,
  LocationAzimuthViewId,
  MediaGenerationDependencyLine,
  MediaGenerationPlanLine,
  ProjectRelativePath,
  SceneShot,
  ShotVideoTakeAvailableInput,
  ShotVideoTakeCastMemberReferenceGroup,
  ShotVideoTakeCharacterSheetReferenceChoice,
  ShotVideoTakeEnvironmentSheetReferenceChoice,
  ShotVideoTakeGeneralReferenceChoice,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationPlan,
  ShotVideoTakeInputKind,
  ShotVideoTakeLocationReferenceGroup,
  ShotVideoTakeLocationViewReferenceChoice,
  ShotVideoTakeLookbookReferenceChoice,
  ShotVideoTakeProductionPlanReport,
  ShotVideoTakeReferenceCardPlan,
  ShotVideoTakeReferenceChoiceState,
  ShotVideoTakeReferenceImagePreview,
} from '../../../client/index.js';
import { readAssetFileRecord } from '../../database/access/asset-files.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../../database/access/asset-relationships/index.js';
import {
  listLocationEnvironmentSheetViews,
  readLocationEnvironmentSheetByAssetId,
} from '../../database/access/location-environment-sheets.js';
import { listLookbookSheets } from '../../database/access/lookbook-sheets.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  castCharacterSheetDependencyId,
  locationEnvironmentSheetDependencyId,
  lookbookSheetDependencyId,
  parseShotVideoInputDependencyId,
  shotVideoInputDependencyId,
} from '../dependency-identifiers.js';

type ShotVideoTakeReferenceSectionScope = {
  castMembers: Array<{
    id?: string;
    name: string;
    role?: string | null;
  }>;
  locations: Array<{
    id?: string;
    name: string;
  }>;
};

type ShotVideoTakeReferenceSections = {
  references: ShotVideoTakeProductionPlanReport['references'];
  diagnostics: DiagnosticIssue[];
};

export function buildShotVideoTakeReferenceSections(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
  narrativeScope: ShotVideoTakeReferenceSectionScope;
  scope: ShotVideoTakeReferenceSectionScope;
}): ShotVideoTakeReferenceSections {
  const narrativeCastMemberIds = new Set(
    input.narrativeScope.castMembers.flatMap((castMember) =>
      castMember.id ? [castMember.id] : []
    )
  );
  const narrativeLocationIds = new Set(
    input.narrativeScope.locations.flatMap((location) =>
      location.id ? [location.id] : []
    )
  );
  const scopedLocationIds = new Set(
    input.scope.locations.flatMap((location) => (location.id ? [location.id] : []))
  );
  const locationSelection = effectiveScopedLocationSelectionForShots(
    input.context.shots,
    scopedLocationIds
  );
  const castMembers = input.narrativeScope.castMembers
    .flatMap((castMember) =>
      castMember.id
        ? [
            buildCastMemberReferenceGroup({
              session: input.session,
              context: input.context,
              plan: input.plan,
              castMemberId: castMember.id,
              name: castMember.name,
              role: castMember.role ?? null,
            }),
          ]
        : []
    )
    .filter((group) => group.characterSheets.length > 0);
  const locations = input.scope.locations.flatMap((location) =>
    location.id
      ? [
          buildLocationReferenceGroup({
            session: input.session,
            context: input.context,
            plan: input.plan,
            locationId: location.id,
            name: location.name,
            useDefaultSelectionWhenNoScopedSelection:
              !locationSelection.hasSelectedScopedLocation,
          }),
        ]
      : []
  );
  const diagnostics = [
    ...outOfScopeReferenceDiagnostics({
      context: input.context,
      sceneCastMemberIds: narrativeCastMemberIds,
      sceneLocationIds: narrativeLocationIds,
    }),
    ...castMembers.flatMap((group) => group.diagnostics),
    ...locations.flatMap((group) => group.diagnostics),
  ];
  return {
    references: {
      general: buildGeneralReferenceChoices({
        context: input.context,
        plan: input.plan,
      }),
      lookbook: buildLookbookReferenceChoices({
        session: input.session,
        context: input.context,
        plan: input.plan,
      }),
      castMembers,
      locations,
    },
    diagnostics,
  };
}

function buildCastMemberReferenceGroup(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
  castMemberId: string;
  name: string;
  role: string | null;
}): ShotVideoTakeCastMemberReferenceGroup {
  const dependencyId = castCharacterSheetDependencyId(input.castMemberId);
  const line = dependencyLineById(input.plan, dependencyId);
  const assets = assetsForTarget(input.session, {
    target: { kind: 'castMember', castMemberId: input.castMemberId },
    role: 'character_sheet',
  });
  const selected = selectedCastIdsForShots(input.context.shots).has(
    input.castMemberId
  );
  const defaultSelected = defaultCastIdsForShots(input.context.shots).has(
    input.castMemberId
  );
  const defaultCharacterSheetAssetId = assets[0]?.assetId ?? null;
  const selectedCharacterSheetAssetId =
    selectedCharacterSheetAssetIdForShots(input.context.shots, input.castMemberId) ??
    defaultCharacterSheetAssetId;
  const characterSheets = assets.map((asset, index) =>
    buildCharacterSheetReferenceChoice({
      castMemberId: input.castMemberId,
      castMemberName: input.name,
      asset,
      selectedAssetId: selectedCharacterSheetAssetId,
      defaultAssetId: defaultCharacterSheetAssetId,
      line,
      planLine: planLineForDependencyLine(input.plan, line),
      index,
    })
  );
  if (characterSheets.length === 0) {
    characterSheets.push({
      id: `${input.castMemberId}:character-sheet-placeholder`,
      castMemberId: input.castMemberId,
      assetId: null,
      title: `${input.name} Character Sheet`,
      selected,
      defaultSelected,
      card: referenceCardPlan({
        selected,
        mediaKind: 'image',
        dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        previews: [],
      }),
    });
  }
  return {
    castMemberId: input.castMemberId,
    name: input.name,
    role: input.role,
    selectedForShot: selected,
    defaultSelectedForShot: defaultSelected,
    selectedCharacterSheetAssetId,
    defaultCharacterSheetAssetId,
    characterSheets,
    diagnostics: [],
  };
}

function buildCharacterSheetReferenceChoice(input: {
  castMemberId: string;
  castMemberName: string;
  asset: Asset;
  selectedAssetId: string | null;
  defaultAssetId: string | null;
  line: MediaGenerationDependencyLine | null;
  planLine: MediaGenerationPlanLine | null;
  index: number;
}): ShotVideoTakeCharacterSheetReferenceChoice {
  const selected = input.asset.assetId === input.selectedAssetId;
  const title =
    humanReadableAssetTitle(input.asset.title, `${input.castMemberName} Character Sheet`) ||
    `${input.castMemberName} Character Sheet`;
  return {
    id: input.asset.assetId,
    castMemberId: input.castMemberId,
    assetId: input.asset.assetId,
    title: input.index === 0 ? title : `${title} ${input.index + 1}`,
    selected,
    defaultSelected: input.asset.assetId === input.defaultAssetId,
    card: referenceCardPlan({
      selected,
      mediaKind: 'image',
      dependencyId: selected
        ? castCharacterSheetDependencyId(input.castMemberId)
        : undefined,
      line: selected ? input.line : undefined,
      planLine: selected ? input.planLine : undefined,
      previews: previewImagesForAsset(
        input.asset,
        title,
        `${input.castMemberName} character sheet`
      ),
    }),
  };
}

function buildLocationReferenceGroup(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
  locationId: string;
  name: string;
  useDefaultSelectionWhenNoScopedSelection: boolean;
}): ShotVideoTakeLocationReferenceGroup {
  const dependencyId = locationEnvironmentSheetDependencyId(input.locationId);
  const line = dependencyLineById(input.plan, dependencyId);
  const assets = assetsForTarget(input.session, {
    target: { kind: 'location', locationId: input.locationId },
    role: 'environment_sheet',
  });
  const selectedLocationIds = selectedLocationIdsForShots(input.context.shots);
  const explicitSelected = selectedLocationIds.has(input.locationId);
  const defaultSelected = defaultLocationIdsForShots(input.context.shots).has(
    input.locationId
  );
  const selected =
    explicitSelected ||
    (input.useDefaultSelectionWhenNoScopedSelection && defaultSelected);
  const defaultEnvironmentSheetAssetId = assets[0]?.assetId ?? null;
  const selectedEnvironmentSheetAssetId =
    selectedEnvironmentSheetAssetIdForShots(input.context.shots, input.locationId) ??
    defaultEnvironmentSheetAssetId;
  const selectedViewIds = selectedLocationViewIdsForShots(
    input.context.shots,
    input.locationId
  );
  const environmentSheets = assets.map((asset, index) =>
    buildEnvironmentSheetReferenceChoice({
      session: input.session,
      locationId: input.locationId,
      locationName: input.name,
      asset,
      selectedAssetId: selectedEnvironmentSheetAssetId,
      defaultAssetId: defaultEnvironmentSheetAssetId,
      selectedViewIds,
      line,
      planLine: planLineForDependencyLine(input.plan, line),
      index,
    })
  );
  if (environmentSheets.length === 0) {
    environmentSheets.push({
      id: `${input.locationId}:planned-environment-sheet`,
      locationId: input.locationId,
      assetId: null,
      title: `${input.name} Location Sheet`,
      selected,
      defaultSelected,
      card: referenceCardPlan({
        selected,
        mediaKind: 'image',
        dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        previews: [],
      }),
      views: [],
    });
  }
  return {
    locationId: input.locationId,
    name: input.name,
    selectedForShot: selected,
    defaultSelectedForShot: defaultSelected,
    selectedEnvironmentSheetAssetId,
    defaultEnvironmentSheetAssetId,
    selectedViewIds,
    environmentSheets,
    diagnostics: [],
  };
}

function buildEnvironmentSheetReferenceChoice(input: {
  session: DatabaseSession;
  locationId: string;
  locationName: string;
  asset: Asset;
  selectedAssetId: string | null;
  defaultAssetId: string | null;
  selectedViewIds: LocationAzimuthViewId[];
  line: MediaGenerationDependencyLine | null;
  planLine: MediaGenerationPlanLine | null;
  index: number;
}): ShotVideoTakeEnvironmentSheetReferenceChoice {
  const selected = input.asset.assetId === input.selectedAssetId;
  const title =
    humanReadableAssetTitle(input.asset.title, `${input.locationName} Location Sheet`) ||
    `${input.locationName} Location Sheet`;
  return {
    id: input.asset.assetId,
    locationId: input.locationId,
    assetId: input.asset.assetId,
    title: input.index === 0 ? title : `${title} ${input.index + 1}`,
    selected,
    defaultSelected: input.asset.assetId === input.defaultAssetId,
    card: referenceCardPlan({
      selected,
      mediaKind: 'image',
      dependencyId: selected
        ? locationEnvironmentSheetDependencyId(input.locationId)
        : undefined,
      line: selected ? input.line : undefined,
      planLine: selected ? input.planLine : undefined,
      previews: previewImagesForAsset(
        input.asset,
        title,
        `${input.locationName} location sheet`
      ),
    }),
    views: selected
      ? locationViewChoices(input.session, input.asset, input.selectedViewIds)
      : [],
  };
}

function buildLookbookReferenceChoices(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
}): ShotVideoTakeLookbookReferenceChoice[] {
  if (!input.context.activeLookbook) {
    return [];
  }
  const lookbookSheets = listLookbookSheets(
    input.session,
    input.context.activeLookbook.id
  );
  const selectedSheetId =
    [...selectedLookbookSheetIdsForShots(input.context.shots)][0] ?? null;
  const defaultSheetId = lookbookSheets[0]?.id ?? null;
  const selectedChoiceId = selectedSheetId ?? defaultSheetId;
  const dependencyId = lookbookSheetDependencyId(input.context.activeLookbook.id);
  const line = dependencyLineById(input.plan, dependencyId);
  const planLine = planLineForDependencyLine(input.plan, line);
  if (lookbookSheets.length === 0) {
    return [
      {
        id: `${input.context.activeLookbook.id}:planned-lookbook-sheet`,
        lookbookSheetId: null,
        lookbookId: input.context.activeLookbook.id,
        title: input.context.activeLookbook.name,
        selected: true,
        defaultSelected: true,
        card: referenceCardPlan({
          selected: true,
          mediaKind: 'image',
          dependencyId,
          line,
          planLine,
          previews: [],
        }),
      },
    ];
  }
  return lookbookSheets.map((lookbookSheet) => ({
    id: lookbookSheet.id,
    lookbookSheetId: lookbookSheet.id,
    lookbookId: input.context.activeLookbook!.id,
    title: humanReadableAssetTitle(lookbookSheet.asset.title, 'Lookbook Sheet'),
    selected: lookbookSheet.id === selectedChoiceId,
    defaultSelected: lookbookSheet.id === defaultSheetId,
    card: referenceCardPlan({
      selected: lookbookSheet.id === selectedChoiceId,
      mediaKind: 'image',
      dependencyId: lookbookSheet.id === selectedChoiceId ? dependencyId : undefined,
      line: lookbookSheet.id === selectedChoiceId ? line : undefined,
      planLine: lookbookSheet.id === selectedChoiceId ? planLine : undefined,
      previews: previewImagesForLookbookSheet(
        lookbookSheet,
        lookbookSheet.asset.title,
        `${lookbookSheet.asset.title} lookbook sheet`
      ),
    }),
  }));
}

function buildGeneralReferenceChoices(input: {
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
}): ShotVideoTakeGeneralReferenceChoice[] {
  const choicesByKey = new Map<string, ShotVideoTakeGeneralReferenceChoice>();
  const plannedInputIds = new Set<string>();
  input.plan.dependencyInventory.dependencies.forEach((line) => {
    const parsed = parseShotVideoInputDependencyId(line.dependencyId);
    const referenceInputKind = parsed.ok
      ? shotReferenceTabInputKind(parsed.value.kind)
      : null;
    if (!referenceInputKind) {
      return;
    }
    const referenceKind = generalReferenceKindForInputKind(referenceInputKind);
    const title = titleForPlannedImageReference(
      input.context,
      referenceInputKind,
      line
    );
    const previews = previewImagesForDependencyLine(input.context, line);
    previews.forEach((preview) => {
      if (preview.inputId) {
        plannedInputIds.add(preview.inputId);
      }
    });
    const choice = {
      id: `planned:${line.dependencyId}`,
      kind: referenceKind,
      title,
      selected: true,
      clearInputSlot: parsed.ok
        ? {
            kind: parsed.value.kind,
            ...(parsed.value.subjectKind
              ? { subjectKind: parsed.value.subjectKind }
              : {}),
            ...(parsed.value.subjectId ? { subjectId: parsed.value.subjectId } : {}),
          }
        : null,
      card: referenceCardPlan({
        selected: true,
        mediaKind: 'image',
        dependencyId: line.dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        previews,
      }),
    };
    choicesByKey.set(`planned:${line.dependencyId}`, choice);
  });
  input.context.availableInputs.forEach((availableInput) => {
    const referenceInputKind = shotReferenceTabInputKind(availableInput.kind);
    if (!referenceInputKind) {
      return;
    }
    if (plannedInputIds.has(availableInput.inputId)) {
      return;
    }
    const dependencyId = shotVideoInputDependencyId({
      kind: referenceInputKind,
      subjectKind: availableInput.subjectKind,
      subjectId: availableInput.subjectId,
    });
    const plannedLine = dependencyLineById(input.plan, dependencyId);
    const line =
      plannedLine?.selectedAsset?.assetId === availableInput.assetId &&
      plannedLine.selectedAsset.assetFileId === availableInput.assetFileId
        ? plannedLine
        : null;
    const referenceKind = generalReferenceKindForInputKind(referenceInputKind);
    const title = titleForAvailableImageReference(input.context, availableInput);
    choicesByKey.set(`input:${availableInput.inputId}`, {
      id: `input:${availableInput.inputId}`,
      kind: referenceKind,
      title,
      selected: availableInput.selected,
      clearInputSlot: {
        kind: referenceInputKind,
        ...(availableInput.subjectKind
          ? { subjectKind: availableInput.subjectKind }
          : {}),
        ...(availableInput.subjectId ? { subjectId: availableInput.subjectId } : {}),
      },
      card: referenceCardPlan({
        selected: availableInput.selected,
        mediaKind: availableInput.mediaKind,
        dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        previews: [
          {
            inputId: availableInput.inputId,
            assetId: availableInput.assetId,
            assetFileId: availableInput.assetFileId,
            projectRelativePath: availableInput.projectRelativePath,
            title,
            alt: title,
          },
        ],
      }),
    });
  });
  return [...choicesByKey.values()];
}

function shotReferenceTabInputKind(
  kind: ShotVideoTakeInputKind
): 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet' | null {
  if (
    kind === 'first-frame' ||
    kind === 'last-frame' ||
    kind === 'reference-image' ||
    kind === 'multi-shot-storyboard-sheet'
  ) {
    return kind;
  }
  return null;
}

function generalReferenceKindForInputKind(
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet'
): ShotVideoTakeGeneralReferenceChoice['kind'] {
  return kind;
}

function titleForAvailableImageReference(
  context: ShotVideoTakeGenerationContext,
  input: ShotVideoTakeAvailableInput
): string {
  if (input.kind === 'first-frame') {
    return 'First Frame';
  }
  if (input.kind === 'last-frame') {
    return 'Last Frame';
  }
  if (input.kind === 'multi-shot-storyboard-sheet') {
    return multiShotStoryboardSheetTitle(context);
  }
  const title = input.title.trim();
  return title.length > 0
    ? humanReadableAssetTitle(title, 'Reference Image')
    : 'Reference Image';
}

function titleForPlannedImageReference(
  context: ShotVideoTakeGenerationContext,
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet',
  line: MediaGenerationDependencyLine
): string {
  if (kind === 'first-frame') {
    return 'First Frame';
  }
  if (kind === 'last-frame') {
    return 'Last Frame';
  }
  if (kind === 'multi-shot-storyboard-sheet') {
    return multiShotStoryboardSheetTitle(context);
  }
  const specTitle =
    line.generationDraft.state === 'authored' &&
    'title' in line.generationDraft.draftGenerationSpec.spec
      ? String(line.generationDraft.draftGenerationSpec.spec.title ?? '').trim()
      : '';
  return humanReadableAssetTitle(specTitle || line.label, 'Reference Image');
}

function multiShotStoryboardSheetTitle(
  context: ShotVideoTakeGenerationContext
): string {
  if (context.target.shotIds.length <= 1) {
    return 'Storyboard sheet';
  }
  return `Storyboard sheet (${context.target.shotIds.length} shots)`;
}

function outOfScopeReferenceDiagnostics(input: {
  context: ShotVideoTakeGenerationContext;
  sceneCastMemberIds: Set<string>;
  sceneLocationIds: Set<string>;
}): DiagnosticIssue[] {
  const diagnostics: DiagnosticIssue[] = [];
  selectedCastIdsForShots(input.context.shots).forEach((castMemberId) => {
    if (!input.sceneCastMemberIds.has(castMemberId)) {
      diagnostics.push(
        createDiagnosticWarning(
          'CORE_SHOT_REFERENCE_CAST_OUTSIDE_NARRATIVE',
          `Shot references cast outside this scene's narrative scope: ${castMemberId}.`,
          { path: ['shotSpecs', 'castReferences', 'castMemberIds'] },
          'Remove the shot cast reference or add the cast member to the scene narrative first.'
        )
      );
    }
  });
  selectedLocationIdsForShots(input.context.shots).forEach((locationId) => {
    if (!input.sceneLocationIds.has(locationId)) {
      diagnostics.push(
        createDiagnosticWarning(
          'CORE_SHOT_REFERENCE_LOCATION_OUTSIDE_NARRATIVE',
          `Shot references a location outside this scene's narrative scope: ${locationId}.`,
          { path: ['shotSpecs', 'location', 'locationId'] },
          'Remove the shot location reference or add the location to the scene narrative first.'
        )
      );
    }
  });
  return diagnostics;
}

function humanReadableAssetTitle(rawTitle: string, fallback: string): string {
  const withoutExtension = rawTitle.trim().replace(/\.[a-z0-9]+$/i, '');
  const normalized = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function selectedCastIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(
    shots.flatMap(
      (shot) => shot.shotSpecs?.castReferences?.castMemberIds ?? shot.castMemberIds
    )
  );
}

function defaultCastIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(shots.flatMap((shot) => shot.castMemberIds));
}

function selectedLocationIdsForShots(shots: SceneShot[]): Set<string> {
  const selected = new Set<string>();
  shots.forEach((shot) => {
    shot.locationIds.forEach((locationId) => selected.add(locationId));
    if (shot.shotSpecs?.location?.locationId) {
      selected.add(shot.shotSpecs.location.locationId);
    }
  });
  return selected;
}

function defaultLocationIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(shots.flatMap((shot) => shot.locationIds));
}

function effectiveScopedLocationSelectionForShots(
  shots: SceneShot[],
  scopedLocationIds: Set<string>
): { locationIds: Set<string>; hasSelectedScopedLocation: boolean } {
  const selectedScopedLocationIds = new Set(
    [...selectedLocationIdsForShots(shots)].filter((locationId) =>
      scopedLocationIds.has(locationId)
    )
  );
  if (selectedScopedLocationIds.size > 0) {
    return {
      locationIds: selectedScopedLocationIds,
      hasSelectedScopedLocation: true,
    };
  }
  return {
    locationIds: new Set(
      [...defaultLocationIdsForShots(shots)].filter((locationId) =>
        scopedLocationIds.has(locationId)
      )
    ),
    hasSelectedScopedLocation: false,
  };
}

function selectedLookbookSheetIdsForShots(shots: SceneShot[]): Set<string> {
  const selected = new Set<string>();
  for (const shot of shots) {
    const lookbookSheetId = shot.shotSpecs?.lookbookReference?.lookbookSheetId;
    if (lookbookSheetId) {
      selected.add(lookbookSheetId);
    }
  }
  return selected;
}

function selectedCharacterSheetAssetIdForShots(
  shots: SceneShot[],
  castMemberId: string
): string | null {
  for (const shot of shots) {
    const assetId = shot.shotSpecs?.castReferences?.characterSheetAssetIds?.[
      castMemberId
    ];
    if (assetId) {
      return assetId;
    }
  }
  return null;
}

function selectedEnvironmentSheetAssetIdForShots(
  shots: SceneShot[],
  locationId: string
): string | null {
  for (const shot of shots) {
    const location = shot.shotSpecs?.location;
    if (location?.locationId === locationId && location.environmentSheetAssetId) {
      return location.environmentSheetAssetId;
    }
  }
  return null;
}

function selectedLocationViewIdsForShots(
  shots: SceneShot[],
  locationId: string
): LocationAzimuthViewId[] {
  for (const shot of shots) {
    const location = shot.shotSpecs?.location;
    if (location?.locationId === locationId && location.viewIds?.length) {
      return [...new Set(location.viewIds)];
    }
  }
  return ['front'];
}

function locationViewChoices(
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

function requireLocationAzimuthDegrees(value: number): 0 | 90 | 180 | 270 {
  if (value === 0 || value === 90 || value === 180 || value === 270) {
    return value;
  }
  throw new ProjectDataError(
    'PROJECT_DATA403',
    `Unsupported location environment sheet azimuth: ${value}.`,
    { suggestion: 'Regenerate the location environment sheet views.' }
  );
}

function locationAzimuthViewId(
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

function locationAzimuthViewLabel(viewId: LocationAzimuthViewId): string {
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

function assetsForTarget(
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

function previewImagesForAsset(
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

function previewImagesForLookbookSheet(
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

function previewImagesForDependencyLine(
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

function dependencyLineById(
  plan: ShotVideoTakeGenerationPlan,
  dependencyId: string
): MediaGenerationDependencyLine | null {
  return (
    plan.dependencyInventory.dependencies.find(
      (line) => line.dependencyId === dependencyId
    ) ?? null
  );
}

function planLineForDependencyLine(
  plan: ShotVideoTakeGenerationPlan,
  line: MediaGenerationDependencyLine | null
): MediaGenerationPlanLine | null {
  if (!line) {
    return null;
  }
  return plan.lines.find((planLine) => planLine.dependencyLineId === line.id) ?? null;
}

function referenceCardPlan(input: {
  selected: boolean;
  mediaKind: ShotVideoTakeReferenceCardPlan['mediaKind'];
  dependencyId?: string;
  line?: MediaGenerationDependencyLine | null;
  planLine?: MediaGenerationPlanLine | null;
  previews?: ShotVideoTakeReferenceImagePreview[];
}): ShotVideoTakeReferenceCardPlan {
  const line = input.line ?? null;
  const planLine = input.planLine ?? null;
  const previews = input.previews ?? [];
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
    purpose: line?.purpose ?? null,
    pricing: line?.pricing ?? {
      state: 'not-applicable',
      estimatedUsd: null,
    },
    previews,
    diagnostics: line?.diagnostics ?? [],
  };
}

function referenceChoiceState(input: {
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
