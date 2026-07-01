import type {
  ShotVideoTakeProductionPlanReport,
  ShotVideoTakeProductionContext,
  ShotVideoTakeOutputGenerationPlan,
  ShotVideoTakeCastMemberReferenceGroup,
  Asset,
  MediaGenerationDependencyLine,
  ShotVideoTakeCharacterSheetReferenceChoice,
  ShotVideoTakeLocationReferenceGroup,
  ShotVideoTakeEnvironmentSheetReferenceChoice,
  ShotVideoTakeLookbookReferenceChoice,
  ShotVideoTakeGeneralReferenceChoice,
  ShotVideoTakeInputKind,
  SceneShotVideoTakeMediaInput,
  ShotVideoTakeDialogueAudioReferenceChoice,
  ShotVideoTakeDialogueAudioCapabilityReport,
  SceneShot,
  SceneShotVideoTakeDirection,
} from '../../../client/index.js';
import {
  listLookbookSheets,
} from '../../database/access/lookbook-sheets.js';
import {
  readScreenplaySceneFromSession,
} from '../../database/access/screenplay-resource.js';
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
  planLineForDependencyLine,
  previewImagesForAsset,
  previewImagesForDependencyLine,
  previewImagesForLookbookSheet,
  referenceCardPlan,
} from './reference-card-plans.js';
import {
  resolveShotDialogueAudioReferences,
} from './dialogue-audio-references.js';
import {
  ReferenceInclusionResolution,
  editorReferenceInclusionForDependencyId,
  requiredGeneralReferenceInclusion,
} from './reference-inclusions.js';
import {
  defaultCastIdsForShots,
  defaultLocationIdsForShots,
  effectiveScopedLocationSelectionForShots,
  selectedCastIdsForShots,
  selectedCharacterSheetAssetIdForEditorDirection,
  selectedLocationSheetAssetIdForEditorDirection,
  selectedLocationIdsForShots,
  selectedLookbookSheetIdForEditorDirection,
} from './reference-selection.js';
import {
  requireScreenplayDocument,
} from './project-session.js';



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
  context: ShotVideoTakeProductionContext;
  plan: ShotVideoTakeOutputGenerationPlan;
  narrativeScope: ShotVideoTakeReferenceSectionScope;
  scope: ShotVideoTakeReferenceSectionScope;
  editorDirection: SceneShotVideoTakeDirection;
  editorShots: SceneShot[];
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
    input.editorShots,
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
              editorDirection: input.editorDirection,
              editorShots: input.editorShots,
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
            editorDirection: input.editorDirection,
            editorShots: input.editorShots,
            plan: input.plan,
            locationId: location.id,
            name: location.name,
            useDefaultSelectionWhenNoScopedSelection:
              !locationSelection.hasSelectedScopedLocation,
          }),
        ]
      : []
  );
  const dialogueAudio = buildDialogueAudioReferenceChoices({
    session: input.session,
    context: input.context,
    editorDirection: input.editorDirection,
    plan: input.plan,
  });
  const dialogueAudioCapability = buildDialogueAudioCapabilityReport({
    plan: input.plan,
    choices: dialogueAudio.choices,
  });
  const diagnostics = [
    ...outOfScopeReferenceDiagnostics({
      context: input.context,
      sceneCastMemberIds: narrativeCastMemberIds,
      sceneLocationIds: narrativeLocationIds,
    }),
    ...castMembers.flatMap((group) => group.diagnostics),
    ...locations.flatMap((group) => group.diagnostics),
    ...dialogueAudio.diagnostics,
    ...dialogueAudioCapability.diagnostics,
  ];
  return {
    references: {
      general: buildGeneralReferenceChoices({
        context: input.context,
        editorDirection: input.editorDirection,
        plan: input.plan,
      }),
      lookbook: buildLookbookReferenceChoices({
        session: input.session,
        context: input.context,
        editorDirection: input.editorDirection,
        plan: input.plan,
      }),
      dialogueAudio: dialogueAudio.choices,
      dialogueAudioCapability,
      castMembers,
      locations,
    },
    diagnostics,
  };
}

export function buildDialogueAudioCapabilityReport(input: {
  plan: ShotVideoTakeOutputGenerationPlan;
  choices: ShotVideoTakeDialogueAudioReferenceChoice[];
}): ShotVideoTakeDialogueAudioCapabilityReport {
  const selectedCount = input.choices.filter((choice) => choice.included).length;
  const audioRole = input.plan.route.inputRoles.find(
    (role) => role.kind === 'audio' && role.mediaKind === 'audio'
  );
  const supported = Boolean(audioRole);
  const maxCount = audioRole?.maxCount ?? null;
  const modelLabel = input.plan.model.label;
  if (!supported) {
    const message = 'This model does not use audio references';
    const diagnostics =
      selectedCount > 0
        ? [
            createDiagnosticWarning(
              'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED',
              message,
              { path: ['take', 'production', 'modelChoice'] },
              'Choose a shot-video model route with audio reference input support or exclude the dialogue audio references.'
            ),
          ]
        : [];
    return {
      state: selectedCount > 0 ? 'unsupported' : 'ok',
      supported: false,
      selectedCount,
      maxCount: null,
      modelLabel,
      message,
      diagnostics,
    };
  }
  const message =
    typeof maxCount === 'number'
      ? `${modelLabel} allows up to ${maxCount} audio references per generation`
      : `${modelLabel} accepts audio references`;
  if (typeof maxCount === 'number' && selectedCount > maxCount) {
    return {
      state: 'over-limit',
      supported: true,
      selectedCount,
      maxCount,
      modelLabel,
      message,
      diagnostics: [
        createDiagnosticWarning(
          'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
          message,
          { path: ['take', 'production', 'requestedInputs'] },
          `Select ${maxCount} or fewer dialogue audio references for this model route.`
        ),
      ],
    };
  }
  return {
    state: 'ok',
    supported: true,
    selectedCount,
    maxCount,
    modelLabel,
    message,
    diagnostics: [],
  };
}



export function buildCastMemberReferenceGroup(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  editorDirection: SceneShotVideoTakeDirection;
  editorShots: SceneShot[];
  plan: ShotVideoTakeOutputGenerationPlan;
  castMemberId: string;
  name: string;
  role: string | null;
}): ShotVideoTakeCastMemberReferenceGroup {
  const assets = assetsForTarget(input.session, {
    target: { kind: 'castMember', castMemberId: input.castMemberId },
    role: 'character_sheet',
  });
  const selected = selectedCastIdsForShots(input.editorShots).has(
    input.castMemberId
  );
  const defaultSelected = defaultCastIdsForShots(input.editorShots).has(
    input.castMemberId
  );
  const defaultCharacterSheetAssetId = assets[0]?.assetId ?? null;
  const selectedCharacterSheetAssetId =
    selectedCharacterSheetAssetIdForEditorDirection(
      input.editorDirection,
      input.castMemberId
    );
  const missingDependencyId = castCharacterSheetDependencyId(input.castMemberId);
  const missingLine = dependencyLineById(input.plan, missingDependencyId);
  const missingInclusion = editorReferenceInclusionForDependencyId(
    input.editorDirection,
    missingDependencyId,
    selected,
    missingLine
  );
  const characterSheets = assets.map((asset, index) =>
    buildCharacterSheetReferenceChoice({
      castMemberId: input.castMemberId,
      castMemberName: input.name,
      asset,
      selectedAssetId: selectedCharacterSheetAssetId,
      defaultAssetId: defaultCharacterSheetAssetId,
      editorDirection: input.editorDirection,
      plan: input.plan,
      index,
    })
  );
  if (characterSheets.length > 0 && selected && !selectedCharacterSheetAssetId) {
    characterSheets.unshift({
      id: `${input.castMemberId}:character-sheet-selection-required`,
      castMemberId: input.castMemberId,
      assetId: null,
      title: `${input.name} Character Sheet`,
      selected: true,
      defaultSelected,
      card: referenceCardPlan({
        selected: selected && missingInclusion.included,
        mediaKind: 'image',
        dependencyId: missingDependencyId,
        line: missingLine,
        planLine: planLineForDependencyLine(input.plan, missingLine),
        inclusion: missingInclusion,
        previews: [],
      }),
    });
  }
  if (characterSheets.length === 0) {
    characterSheets.push({
      id: `${input.castMemberId}:character-sheet-placeholder`,
      castMemberId: input.castMemberId,
      assetId: null,
      title: `${input.name} Character Sheet`,
      selected,
      defaultSelected,
      card: referenceCardPlan({
        selected: selected && missingInclusion.included,
        mediaKind: 'image',
        dependencyId: missingDependencyId,
        line: missingLine,
        planLine: planLineForDependencyLine(input.plan, missingLine),
        inclusion: missingInclusion,
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
  editorDirection: SceneShotVideoTakeDirection;
  plan: ShotVideoTakeOutputGenerationPlan;
  index: number;
}): ShotVideoTakeCharacterSheetReferenceChoice {
  const selected = input.asset.assetId === input.selectedAssetId;
  const dependencyId = castCharacterSheetDependencyId(
    input.castMemberId,
    input.asset.assetId
  );
  const line = dependencyLineById(input.plan, dependencyId);
  const inclusion = editorReferenceInclusionForDependencyId(
    input.editorDirection,
    dependencyId,
    selected,
    line
  );
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
      selected: selected && inclusion.included,
      mediaKind: 'image',
      dependencyId: selected ? dependencyId : undefined,
      line: selected ? line : undefined,
      planLine: selected ? planLineForDependencyLine(input.plan, line) : undefined,
      inclusion,
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
  context: ShotVideoTakeProductionContext;
  editorDirection: SceneShotVideoTakeDirection;
  editorShots: SceneShot[];
  plan: ShotVideoTakeOutputGenerationPlan;
  locationId: string;
  name: string;
  useDefaultSelectionWhenNoScopedSelection: boolean;
}): ShotVideoTakeLocationReferenceGroup {
  const assets = assetsForTarget(input.session, {
    target: { kind: 'location', locationId: input.locationId },
    role: 'environment_sheet',
  });
  const selectedLocationIds = selectedLocationIdsForShots(input.editorShots);
  const explicitSelected = selectedLocationIds.has(input.locationId);
  const defaultSelected = defaultLocationIdsForShots(input.editorShots).has(
    input.locationId
  );
  const selected =
    explicitSelected ||
    (input.useDefaultSelectionWhenNoScopedSelection && defaultSelected);
  const selectedLocationSheetAssetId = selectedLocationSheetAssetIdForEditorDirection(
    input.editorDirection,
    input.locationId
  );
  const missingDependencyId = locationEnvironmentSheetDependencyId(input.locationId);
  const missingLine = dependencyLineById(input.plan, missingDependencyId);
  const missingInclusion = editorReferenceInclusionForDependencyId(
    input.editorDirection,
    missingDependencyId,
    selected,
    missingLine
  );
  const environmentSheets = assets.map((asset, index) =>
    buildEnvironmentSheetReferenceChoice({
      locationId: input.locationId,
      locationName: input.name,
      asset,
      selectedAssetId: selectedLocationSheetAssetId,
      editorDirection: input.editorDirection,
      context: input.context,
      plan: input.plan,
      index,
    })
  );
  if (environmentSheets.length > 0 && selected && !selectedLocationSheetAssetId) {
    environmentSheets.unshift({
      id: `${input.locationId}:location-sheet-selection-required`,
      locationId: input.locationId,
      assetId: null,
      title: `${input.name} Location Sheet`,
      description: null,
      selected: true,
      card: referenceCardPlan({
        selected: selected && missingInclusion.included,
        mediaKind: 'image',
        dependencyId: missingDependencyId,
        line: missingLine,
        planLine: planLineForDependencyLine(input.plan, missingLine),
        inclusion: missingInclusion,
        previews: [],
      }),
    });
  }
  if (environmentSheets.length === 0) {
    if (!missingLine) {
      return {
        locationId: input.locationId,
        name: input.name,
        selectedForShot: selected,
        defaultSelectedForShot: defaultSelected,
        selectedLocationSheetAssetId,
        environmentSheets,
        diagnostics: [],
      };
    }
    environmentSheets.push({
      id: `${input.locationId}:planned-environment-sheet`,
      locationId: input.locationId,
      assetId: null,
      title: `${input.name} Location Sheet`,
      description: null,
      selected,
      card: referenceCardPlan({
        selected: selected && missingInclusion.included,
        mediaKind: 'image',
        dependencyId: missingDependencyId,
        line: missingLine,
        planLine: planLineForDependencyLine(input.plan, missingLine),
        inclusion: missingInclusion,
        previews: [],
      }),
    });
  }
  return {
    locationId: input.locationId,
    name: input.name,
    selectedForShot: selected,
    defaultSelectedForShot: defaultSelected,
    selectedLocationSheetAssetId,
    environmentSheets,
    diagnostics: [],
  };
}



export function buildEnvironmentSheetReferenceChoice(input: {
  locationId: string;
  locationName: string;
  asset: Asset;
  selectedAssetId: string | null;
  editorDirection: SceneShotVideoTakeDirection;
  context: ShotVideoTakeProductionContext;
  plan: ShotVideoTakeOutputGenerationPlan;
  index: number;
}): ShotVideoTakeEnvironmentSheetReferenceChoice {
  const selected = input.asset.assetId === input.selectedAssetId;
  const dependencyId = locationEnvironmentSheetDependencyId(
    input.locationId,
    input.asset.assetId
  );
  const line = dependencyLineById(input.plan, dependencyId);
  const inclusion = editorReferenceInclusionForDependencyId(
    input.editorDirection,
    dependencyId,
    selected
  );
  const title =
    humanReadableAssetTitle(input.asset.title, `${input.locationName} Location Sheet`) ||
    `${input.locationName} Location Sheet`;
  return {
    id: input.asset.assetId,
    locationId: input.locationId,
    assetId: input.asset.assetId,
    title: input.index === 0 ? title : `${title} ${input.index + 1}`,
    description: input.asset.oneLineSummary,
    selected,
    card: referenceCardPlan({
      selected: selected && inclusion.included,
      mediaKind: 'image',
      dependencyId: selected
        ? dependencyId
        : undefined,
      line: selected ? line : undefined,
      planLine: selected ? planLineForDependencyLine(input.plan, line) : undefined,
      inclusion,
      previews: previewImagesForAsset(
        input.asset,
        title,
        `${input.locationName} location sheet`
      ),
    }),
  };
}



export function buildLookbookReferenceChoices(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  editorDirection: SceneShotVideoTakeDirection;
  plan: ShotVideoTakeOutputGenerationPlan;
}): ShotVideoTakeLookbookReferenceChoice[] {
  if (!input.context.activeLookbook) {
    return [];
  }
  const lookbookSheets = listLookbookSheets(
    input.session,
    input.context.activeLookbook.id
  );
  const selectedSheetId = selectedLookbookSheetIdForEditorDirection(
    input.editorDirection
  );
  const defaultSheetId = lookbookSheets[0]?.id ?? null;
  const selectedChoiceId = selectedSheetId ?? defaultSheetId;
  const dependencyId = lookbookSheetDependencyId(input.context.activeLookbook.id);
  const line = dependencyLineById(input.plan, dependencyId);
  const planLine = planLineForDependencyLine(input.plan, line);
  const inclusion = editorReferenceInclusionForDependencyId(
    input.editorDirection,
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



export function buildDialogueAudioReferenceChoices(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  editorDirection: SceneShotVideoTakeDirection;
  plan: ShotVideoTakeOutputGenerationPlan;
}): {
  choices: ShotVideoTakeDialogueAudioReferenceChoice[];
  diagnostics: DiagnosticIssue[];
} {
  const screenplay = requireScreenplayDocument(input.session);
  const scene = readScreenplaySceneFromSession(input.session, input.context.scene.id);
  const resolved = resolveShotDialogueAudioReferences({
    session: input.session,
    screenplay,
    scene,
    context: input.context,
    editorDirection: input.editorDirection,
  });
  const choices = resolved.references.map((reference) => {
    const line = dependencyLineById(input.plan, reference.dependencyId);
    const inclusion = editorReferenceInclusionForDependencyId(
      input.editorDirection,
      reference.dependencyId,
      reference.defaultIncluded,
      line
    );
    return {
      dependencyId: reference.dependencyId,
      dialogueId: reference.dialogueId,
      castMemberId: reference.castMemberId,
      speakerName: reference.speakerName,
      plainText: reference.plainText,
      audioState: reference.audioState,
      selectedTake: reference.selectedTake
        ? {
            takeId: reference.selectedTake.takeId,
            takeLabel: reference.selectedTakeLabel ?? 'Take',
            createdAt: reference.selectedTake.createdAt,
            assetId: reference.selectedTake.assetId,
            assetFileId: reference.selectedTake.assetFileId,
          }
        : null,
      takeCount: reference.takeCount,
      defaultIncluded: inclusion.defaultIncluded,
      included: inclusion.included,
      required: inclusion.required,
      unavailableReason: reference.unavailableReason,
      card: referenceCardPlan({
        selected: inclusion.included,
        mediaKind: 'audio',
        dependencyId: reference.dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        inclusion,
        previews: [],
      }),
    };
  });
  return {
    choices,
    diagnostics: resolved.diagnostics,
  };
}



export function buildGeneralReferenceChoices(input: {
  context: ShotVideoTakeProductionContext;
  editorDirection: SceneShotVideoTakeDirection;
  plan: ShotVideoTakeOutputGenerationPlan;
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
    const inclusion = editorReferenceInclusionForDependencyId(
      input.editorDirection,
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
  input.context.take.state.production.requestedInputs?.forEach(
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
      const inclusion = editorReferenceInclusionForDependencyId(
        input.editorDirection,
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
  excludedDefaultGeneralReferenceChoices({
    context: input.context,
    editorDirection: input.editorDirection,
  }).forEach((excludedChoice) => {
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
  input.context.mediaInputs.forEach((mediaInput) => {
    const referenceInputKind = shotReferenceTabInputKind(mediaInput.kind);
    if (!referenceInputKind) {
      return;
    }
    if (plannedInputIds.has(mediaInput.inputId)) {
      return;
    }
    const dependencyId = shotVideoInputDependencyId({
      kind: referenceInputKind,
      subjectKind: mediaInput.subjectKind,
      subjectId: mediaInput.subjectId,
    });
    const plannedLine = dependencyLineById(input.plan, dependencyId);
    const line =
      plannedLine?.selectedAsset?.assetId === mediaInput.assetId &&
      plannedLine.selectedAsset.assetFileId === mediaInput.assetFileId
        ? plannedLine
        : null;
    const referenceKind = generalReferenceKindForInputKind(referenceInputKind);
    const title = titleForAvailableImageReference(input.context, mediaInput);
    const inclusion = editorReferenceInclusionForDependencyId(
      input.editorDirection,
      dependencyId,
      mediaInput.selected,
      line
    );
    const cardInclusion = requiredGeneralReferenceInclusion({
      context: input.context,
      kind: referenceInputKind,
      selected: mediaInput.selected,
      inclusion,
    });
    choicesByKey.set(`input:${mediaInput.inputId}`, {
      id: `input:${mediaInput.inputId}`,
      kind: referenceKind,
      title,
      selected: inclusion.included,
      clearInputSlot: {
        kind: referenceInputKind,
        ...(mediaInput.subjectKind
          ? { subjectKind: mediaInput.subjectKind }
          : {}),
        ...(mediaInput.subjectId ? { subjectId: mediaInput.subjectId } : {}),
      },
      card: referenceCardPlan({
        selected: inclusion.included,
        mediaKind: mediaInput.mediaKind,
        dependencyId,
        line,
        planLine: planLineForDependencyLine(input.plan, line),
        inclusion: cardInclusion,
        previews: [
          {
            inputId: mediaInput.inputId,
            takeId: mediaInput.takeId,
            assetId: mediaInput.assetId,
            assetFileId: mediaInput.assetFileId,
            projectRelativePath: mediaInput.projectRelativePath,
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
  input: {
    context: ShotVideoTakeProductionContext;
    editorDirection: SceneShotVideoTakeDirection;
  }
): Array<{
  dependencyId: string;
  kind: 'video-prompt-sheet';
  title: string;
  inclusion: ReferenceInclusionResolution;
}> {
  if (input.context.shotGroupMode !== 'multi-shot') {
    return [];
  }
  const dependencyId = shotVideoInputDependencyId({
    kind: 'video-prompt-sheet',
    target: input.context.target,
  });
  const inclusion = editorReferenceInclusionForDependencyId(
    input.editorDirection,
    dependencyId,
    true
  );
  if (inclusion.included) {
    return [];
  }
  return [
    {
      dependencyId,
      kind: 'video-prompt-sheet',
      title: videoPromptSheetTitle(input.context),
      inclusion,
    },
  ];
}



export function shotReferenceTabInputKind(
  kind: ShotVideoTakeInputKind
): 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet' | null {
  if (
    kind === 'first-frame' ||
    kind === 'last-frame' ||
    kind === 'reference-image' ||
    kind === 'video-prompt-sheet'
  ) {
    return kind;
  }
  return null;
}



export function generalReferenceKindForInputKind(
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet'
): ShotVideoTakeGeneralReferenceChoice['kind'] {
  return kind;
}



export function titleForAvailableImageReference(
  context: ShotVideoTakeProductionContext,
  input: SceneShotVideoTakeMediaInput
): string {
  if (input.kind === 'first-frame') {
    return 'First Frame';
  }
  if (input.kind === 'last-frame') {
    return 'Last Frame';
  }
  if (input.kind === 'video-prompt-sheet') {
    return videoPromptSheetTitle(context);
  }
  const title = input.title.trim();
  return title.length > 0
    ? humanReadableAssetTitle(title, 'Reference Image')
    : 'Reference Image';
}



export function titleForPlannedImageReference(
  context: ShotVideoTakeProductionContext,
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet',
  line: MediaGenerationDependencyLine
): string {
  if (kind === 'first-frame') {
    return 'First Frame';
  }
  if (kind === 'last-frame') {
    return 'Last Frame';
  }
  if (kind === 'video-prompt-sheet') {
    return videoPromptSheetTitle(context);
  }
  const specTitle =
    line.generationDraft.state === 'authored' &&
    'title' in line.generationDraft.draftGenerationSpec.spec
      ? String(line.generationDraft.draftGenerationSpec.spec.title ?? '').trim()
      : '';
  return humanReadableAssetTitle(specTitle || line.label, 'Reference Image');
}



export function titleForRequestedImageReference(
  context: ShotVideoTakeProductionContext,
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet'
): string {
  if (kind === 'first-frame') {
    return 'First Frame';
  }
  if (kind === 'last-frame') {
    return 'Last Frame';
  }
  if (kind === 'video-prompt-sheet') {
    return videoPromptSheetTitle(context);
  }
  return 'Reference Image';
}



export function videoPromptSheetTitle(
  context: ShotVideoTakeProductionContext
): string {
  if (context.target.shotIds.length <= 1) {
    return 'Video Prompt Sheet';
  }
  return `Video Prompt Sheet (${context.target.shotIds.length} shots)`;
}



export function outOfScopeReferenceDiagnostics(input: {
  context: ShotVideoTakeProductionContext;
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
          { path: ['shots', 'castMemberIds'] },
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
          { path: ['shots', 'locationIds'] },
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
