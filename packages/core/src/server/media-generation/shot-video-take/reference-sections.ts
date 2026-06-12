import type {
  ShotVideoTakeProductionPlanReport,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationPlan,
  ShotVideoTakeCastMemberReferenceGroup,
  Asset,
  MediaGenerationDependencyLine,
  MediaGenerationPlanLine,
  ShotVideoTakeCharacterSheetReferenceChoice,
  ShotVideoTakeLocationReferenceGroup,
  LocationAzimuthViewId,
  ShotVideoTakeEnvironmentSheetReferenceChoice,
  ShotVideoTakeLookbookReferenceChoice,
  ShotVideoTakeGeneralReferenceChoice,
  ShotVideoTakeInputKind,
  ShotVideoTakeAvailableInput,
} from '../../../client/index.js';
import {
  listLookbookSheets,
} from '../../database/access/lookbook-sheets.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  castCharacterSheetDependencyId,
  locationEnvironmentSheetDependencyId,
  lookbookSheetDependencyId,
  parseShotVideoInputDependencyId,
  shotVideoInputDependencyId,
} from '../dependency-identifiers.js';
import {
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assetsForTarget,
  dependencyLineById,
  locationViewChoices,
  planLineForDependencyLine,
  previewImagesForAsset,
  previewImagesForDependencyLine,
  previewImagesForLookbookSheet,
  referenceCardPlan,
} from './reference-card-plans.js';
import {
  ReferenceInclusionResolution,
  referenceInclusionForDependencyId,
  requiredGeneralReferenceInclusion,
} from './reference-inclusions.js';
import {
  defaultCastIdsForShots,
  defaultLocationIdsForShots,
  effectiveScopedLocationSelectionForShots,
  selectedCastIdsForShots,
  selectedCharacterSheetAssetIdForShots,
  selectedEnvironmentSheetAssetIdForShots,
  selectedLocationIdsForShots,
  selectedLocationViewIdsForShots,
  selectedLookbookSheetIdsForShots,
} from './reference-selection.js';



export type ShotVideoTakeReferenceSectionScope = {
  castMembers: Array<{
    id?: string;
    name: string;
    role?: string | null;
    isVoiceOver?: boolean;
  }>;
  locations: Array<{
    id?: string;
    name: string;
  }>;
};



export type ShotVideoTakeReferenceSections = {
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
    .filter((castMember) => !castMember.isVoiceOver)
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



export function buildCastMemberReferenceGroup(input: {
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
  const inclusion = referenceInclusionForDependencyId(
    input.context,
    dependencyId,
    selected,
    line
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
      inclusion,
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
        selected: selected && inclusion.included,
        mediaKind: 'image',
        dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        inclusion,
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



export function buildCharacterSheetReferenceChoice(input: {
  castMemberId: string;
  castMemberName: string;
  asset: Asset;
  selectedAssetId: string | null;
  defaultAssetId: string | null;
  line: MediaGenerationDependencyLine | null;
  planLine: MediaGenerationPlanLine | null;
  inclusion: ReferenceInclusionResolution;
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
      selected: selected && input.inclusion.included,
      mediaKind: 'image',
      dependencyId: selected
        ? castCharacterSheetDependencyId(input.castMemberId)
        : undefined,
      line: selected ? input.line : undefined,
      planLine: selected ? input.planLine : undefined,
      inclusion: input.inclusion,
      previews: previewImagesForAsset(
        input.asset,
        title,
        `${input.castMemberName} character sheet`
      ),
    }),
  };
}



export function buildLocationReferenceGroup(input: {
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
  const inclusion = referenceInclusionForDependencyId(
    input.context,
    dependencyId,
    selected
  );
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
      inclusion,
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
        selected: selected && inclusion.included,
        mediaKind: 'image',
        dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        inclusion,
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



export function buildEnvironmentSheetReferenceChoice(input: {
  session: DatabaseSession;
  locationId: string;
  locationName: string;
  asset: Asset;
  selectedAssetId: string | null;
  defaultAssetId: string | null;
  selectedViewIds: LocationAzimuthViewId[];
  line: MediaGenerationDependencyLine | null;
  planLine: MediaGenerationPlanLine | null;
  inclusion: ReferenceInclusionResolution;
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
      selected: selected && input.inclusion.included,
      mediaKind: 'image',
      dependencyId: selected
        ? locationEnvironmentSheetDependencyId(input.locationId)
        : undefined,
      line: selected ? input.line : undefined,
      planLine: selected ? input.planLine : undefined,
      inclusion: input.inclusion,
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



export function buildLookbookReferenceChoices(input: {
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
  const inclusion = referenceInclusionForDependencyId(
    input.context,
    dependencyId,
    true
  );
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
          inclusion,
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
      selected: lookbookSheet.id === selectedChoiceId && inclusion.included,
      mediaKind: 'image',
      dependencyId: lookbookSheet.id === selectedChoiceId ? dependencyId : undefined,
      line: lookbookSheet.id === selectedChoiceId ? line : undefined,
      planLine: lookbookSheet.id === selectedChoiceId ? planLine : undefined,
      inclusion,
      previews: previewImagesForLookbookSheet(
        lookbookSheet,
        lookbookSheet.asset.title,
        `${lookbookSheet.asset.title} lookbook sheet`
      ),
    }),
  }));
}



export function buildGeneralReferenceChoices(input: {
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
    const inclusion = referenceInclusionForDependencyId(
      input.context,
      line.dependencyId,
      true
    );
    const cardInclusion = requiredGeneralReferenceInclusion({
      context: input.context,
      kind: referenceInputKind,
      selected: true,
      inclusion,
    });
    previews.forEach((preview) => {
      if (preview.inputId) {
        plannedInputIds.add(preview.inputId);
      }
    });
    const choice = {
      id: `planned:${line.dependencyId}`,
      kind: referenceKind,
      title,
      selected: inclusion.included,
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
        selected: inclusion.included,
        mediaKind: 'image',
        dependencyId: line.dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        inclusion: cardInclusion,
        previews,
      }),
    };
    choicesByKey.set(`planned:${line.dependencyId}`, choice);
  });
  input.context.productionGroup.videoTakeProduction.requestedInputs?.forEach(
    (requestedInput) => {
      const referenceInputKind = shotReferenceTabInputKind(requestedInput.kind);
      if (!referenceInputKind) {
        return;
      }
      const dependencyId = shotVideoInputDependencyId({
        kind: referenceInputKind,
        subjectKind: requestedInput.subjectKind,
        subjectId: requestedInput.subjectId,
      });
      if (choicesByKey.has(`planned:${dependencyId}`)) {
        return;
      }
      const inclusion = referenceInclusionForDependencyId(
        input.context,
        dependencyId,
        true
      );
      if (inclusion.included) {
        return;
      }
      const referenceKind = generalReferenceKindForInputKind(referenceInputKind);
      const title = titleForRequestedImageReference(
        input.context,
        referenceInputKind
      );
      choicesByKey.set(`requested:${dependencyId}`, {
        id: `requested:${dependencyId}`,
        kind: referenceKind,
        title,
        selected: false,
        clearInputSlot: null,
        card: referenceCardPlan({
          selected: false,
          mediaKind: 'image',
          dependencyId,
          inclusion: requiredGeneralReferenceInclusion({
            context: input.context,
            kind: referenceInputKind,
            selected: false,
            inclusion,
          }),
        }),
      });
    }
  );
  excludedDefaultGeneralReferenceChoices(input.context).forEach((excludedChoice) => {
    const existingChoice = [...choicesByKey.values()].find(
      (choice) => choice.card.dependencyId === excludedChoice.dependencyId
    );
    if (!existingChoice) {
      choicesByKey.set(`excluded:${excludedChoice.dependencyId}`, {
        id: `excluded:${excludedChoice.dependencyId}`,
        kind: excludedChoice.kind,
        title: excludedChoice.title,
        selected: false,
        clearInputSlot: null,
        card: referenceCardPlan({
          selected: false,
          mediaKind: 'image',
          dependencyId: excludedChoice.dependencyId,
          inclusion: excludedChoice.inclusion,
        }),
      });
    }
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
    const inclusion = referenceInclusionForDependencyId(
      input.context,
      dependencyId,
      availableInput.selected,
      line
    );
    const cardInclusion = requiredGeneralReferenceInclusion({
      context: input.context,
      kind: referenceInputKind,
      selected: availableInput.selected,
      inclusion,
    });
    choicesByKey.set(`input:${availableInput.inputId}`, {
      id: `input:${availableInput.inputId}`,
      kind: referenceKind,
      title,
      selected: inclusion.included,
      clearInputSlot: {
        kind: referenceInputKind,
        ...(availableInput.subjectKind
          ? { subjectKind: availableInput.subjectKind }
          : {}),
        ...(availableInput.subjectId ? { subjectId: availableInput.subjectId } : {}),
      },
      card: referenceCardPlan({
        selected: inclusion.included,
        mediaKind: availableInput.mediaKind,
        dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        inclusion: cardInclusion,
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



export function excludedDefaultGeneralReferenceChoices(
  context: ShotVideoTakeGenerationContext
): Array<{
  dependencyId: string;
  kind: 'multi-shot-storyboard-sheet';
  title: string;
  inclusion: ReferenceInclusionResolution;
}> {
  if (context.shotGroupMode !== 'multi-shot') {
    return [];
  }
  const dependencyId = shotVideoInputDependencyId({
    kind: 'multi-shot-storyboard-sheet',
    target: context.target,
  });
  const inclusion = referenceInclusionForDependencyId(context, dependencyId, true);
  if (inclusion.included) {
    return [];
  }
  return [
    {
      dependencyId,
      kind: 'multi-shot-storyboard-sheet',
      title: multiShotStoryboardSheetTitle(context),
      inclusion,
    },
  ];
}



export function shotReferenceTabInputKind(
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



export function generalReferenceKindForInputKind(
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet'
): ShotVideoTakeGeneralReferenceChoice['kind'] {
  return kind;
}



export function titleForAvailableImageReference(
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



export function titleForPlannedImageReference(
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



export function titleForRequestedImageReference(
  context: ShotVideoTakeGenerationContext,
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'multi-shot-storyboard-sheet'
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
  return 'Reference Image';
}



export function multiShotStoryboardSheetTitle(
  context: ShotVideoTakeGenerationContext
): string {
  if (context.target.shotIds.length <= 1) {
    return 'Multi-Shot Storyboard Reference';
  }
  return `Multi-Shot Storyboard Reference (${context.target.shotIds.length} shots)`;
}



export function outOfScopeReferenceDiagnostics(input: {
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



export function humanReadableAssetTitle(rawTitle: string, fallback: string): string {
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
