import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  ShotVideoTakeProductionContext,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  SceneShotVideoTakeProductionState,
  ShotVideoTakePreflightInput,
  ShotVideoTakeInputPolicy,
  MediaGenerationDependencyInventory,
  ShotVideoTakePreflightReport,
  MediaGenerationDependencySlot,
  ShotVideoTakeOutputGenerationSpec,
} from '../../../../../client/index.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  readScreenplaySceneFromSession,
} from '../../../../database/access/screenplay-resource.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  planMediaGenerationDependencyInventory,
} from '../../../dependencies/dependency-inventory.js';
import type {
  MediaGenerationDependencyRootEstimate,
} from '../../../dependencies/dependency-inventory.js';
import {
  resolveMediaGenerationDependencySelection,
} from '../../../dependencies/dependency-selectors.js';
import type {
  MediaGenerationDependencyDeclarationInput,
} from '../../../lifecycle/purpose-definition.js';
import {
  declareShotVideoTakeDependencySlots,
} from './dependency-slots.js';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import type {
  ShotVideoRoute,
} from '@gorenku/studio-engines';
import {
  buildContextFromPrepared,
} from '../authoring/context.js';
import {
  ShotVideoTakeDependencyRequest,
} from './dependency-draft-specs.js';
import {
  resolveShotDialogueAudioReferences,
} from './dialogue-audio-references.js';
import type {
  ResolvedShotDialogueAudioReference,
} from './dialogue-audio-references.js';
import {
  IMAGE_CREATE_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import {
  requireShotVideoTakeRoute,
} from '../shared/route-settings.js';
import {
  filterPreparedInputsByReferenceInclusions,
  generationReferenceInclusionForDependencyId,
  referenceDependencySlotIncluded,
  validateRequiredReferenceInclusions,
} from './reference-inclusions.js';
import {
  selectedLocationSheetAssetIdsForGenerationTakeState,
  selectedCharacterSheetAssetIdsForGenerationTakeState,
  selectedLookbookSheetIdsForGenerationTakeState,
} from '../selection/reference-selection.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  prepareSceneShotVideoTakeInSession,
} from '../authoring/take-context.js';
import {
  estimateShotVideoTakeFinalPlanLine,
} from '../../../lifecycle/shot-video-take-estimates.js';



export async function buildShotVideoTakeDependencyInventory(input: {
  session: DatabaseSession;
  projectName?: string;
  homeDir?: string;
  context: ShotVideoTakeProductionContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  route: ShotVideoRoute;
  normalizedSettings: NonNullable<SceneShotVideoTakeProductionState['parameterValues']>;
  preparedInputs: ShotVideoTakePreflightInput[];
  inputPolicy: ShotVideoTakeInputPolicy;
  diagnostics: DiagnosticIssue[];
}): Promise<MediaGenerationDependencyInventory> {
  const screenplay = requireScreenplayDocument(input.session);
  const scene = readScreenplaySceneFromSession(input.session, input.context.scene.id);
  const dialogueAudioResolution = resolveShotDialogueAudioReferences({
    session: input.session,
    screenplay,
    scene,
    context: input.context,
  });
  input.diagnostics.push(...dialogueAudioResolution.diagnostics);
  const dialogueAudioReferencesByDependencyId = new Map(
    dialogueAudioResolution.references.map((reference) => [
      reference.dependencyId,
      reference,
    ])
  );
  const requiredSlots = [
    ...shotVideoTakeDependencySlotsForContext({
      session: input.session,
      context: input.context,
      inputModeId: input.inputModeId,
      route: input.route,
      includeReferenceContext: true,
    }),
    ...shotVideoTakeDialogueAudioDependencySlots({
      context: input.context,
      references: dialogueAudioResolution.references,
    }),
  ];
  validateRequiredReferenceInclusions({
    context: input.context,
    slots: requiredSlots,
  });
  const activeSlots = requiredSlots.filter((slot) =>
    referenceDependencySlotIncluded(input.context, slot)
  );
  const requiredSlotsByDependencyId = new Map(
    activeSlots.map((slot) => [slot.dependencyId, slot])
  );
  const finalLineId = 'root:shot.video-take';
  const finalInputs = filterPreparedInputsByReferenceInclusions(
    input.context,
    input.preparedInputs
  );
  validateSelectedAudioReferencesSupportedByRoute({
    route: input.route,
    context: input.context,
    references: dialogueAudioResolution.references,
    diagnostics: input.diagnostics,
  });
  const result = await planMediaGenerationDependencyInventory({
    projectName: input.projectName,
    homeDir: input.homeDir,
    rootPurpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    rootTarget: input.context.target,
    rootLineId: finalLineId,
    rootLabel: 'Final video take',
    rootMediaKind: 'video',
    request: {
      kind: 'shot-video-take',
      context: input.context,
    } satisfies ShotVideoTakeDependencyRequest,
    slots: activeSlots,
    diagnostics: input.diagnostics,
    inputPolicyMode: (dependencyId) => inputPolicyMode(input.inputPolicy, dependencyId),
    resolveSelection: async (slot) => {
      if (slot.selector.kind !== 'shot-video-input') {
        return resolveMediaGenerationDependencySelection({
          request: {
            kind: 'shot-video-take',
            context: input.context,
          } satisfies ShotVideoTakeDependencyRequest,
          session: input.session,
          slot,
        });
      }
      const requiredSlot = requiredSlotsByDependencyId.get(slot.dependencyId);
      if (!requiredSlot) {
        return { state: 'missing', asset: null, diagnostics: [] };
      }
      const dialogueAudioReference = dialogueAudioReferencesByDependencyId.get(
        requiredSlot.dependencyId
      );
      if (
        dialogueAudioReference?.audioState === 'no-selected-take' ||
        dialogueAudioReference?.audioState === 'missing-file'
      ) {
        return {
          state: 'invalid-selection',
          asset: null,
          diagnostics: dialogueAudioReference.diagnostics,
        };
      }
      const prepared = input.preparedInputs.find((candidate) =>
        preparedInputMatchesSlot(candidate, requiredSlot)
      );
      return prepared
        ? {
            state: 'satisfied',
            asset: {
              assetId: prepared.assetId,
              assetFileId: prepared.assetFileId,
              projectRelativePath: prepared.projectRelativePath,
            },
            diagnostics: [],
          }
        : { state: 'missing', asset: null, diagnostics: [] };
    },
    declareDependencies: async ({ purpose }) =>
      purpose === IMAGE_CREATE_GENERATION_PURPOSE
        ? shotVideoTakeReferenceDependencySlotsForContext({
            session: input.session,
            context: input.context,
          }).filter((slot) => referenceDependencySlotIncluded(input.context, slot))
        : [],
    estimateRoot: async (): Promise<MediaGenerationDependencyRootEstimate> => {
      const finalPricing = await estimateShotVideoTakeFinalPlanLine({
        context: input.context,
        inputModeId: input.inputModeId,
        modelChoice: input.modelChoice,
        normalizedSettings: input.normalizedSettings,
        preparedInputs: finalInputs,
        diagnostics: input.diagnostics,
      });
      return finalPricing;
    },
  });
  const dependencyInventory: MediaGenerationDependencyInventory & {
    finalEstimate?: ShotVideoTakePreflightReport['estimate'];
  } = result.dependencyInventory;
  dependencyInventory.finalEstimate = result.rootEstimate;
  return dependencyInventory;
}

function validateSelectedAudioReferencesSupportedByRoute(input: {
  route: ShotVideoRoute;
  context: ShotVideoTakeProductionContext;
  references: ResolvedShotDialogueAudioReference[];
  diagnostics: DiagnosticIssue[];
}): void {
  const selectedCount = input.references.filter((reference) =>
    generationReferenceInclusionForDependencyId(
      input.context,
      reference.dependencyId,
      reference.defaultIncluded
    ).included
  ).length;
  if (selectedCount === 0) {
    return;
  }
  const audioSlot = input.route.inputSlots.find(
    (slot) => slot.kind === 'audio' && slot.mediaKind === 'audio'
  );
  if (!audioSlot) {
    input.diagnostics.push(
      createDiagnosticWarning(
        'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED',
        'This model does not use audio references',
        { path: ['take', 'production', 'modelChoice'] },
        'Choose a shot-video model route with audio reference input support or exclude the dialogue audio references.'
      )
    );
    return;
  }
  if (typeof audioSlot.maxCount === 'number' && selectedCount > audioSlot.maxCount) {
    input.diagnostics.push(
      createDiagnosticWarning(
        'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
        `Selected dialogue audio references exceed this model route limit: ${selectedCount} / ${audioSlot.maxCount}.`,
        { path: ['take', 'production', 'requestedInputs'] },
        `Select ${audioSlot.maxCount} or fewer dialogue audio references for this model route.`
      )
    );
  }
}



export function shotVideoTakeDependencySlotsForContext(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  inputModeId: ShotVideoTakeInputModeId;
  route: ShotVideoRoute;
  includeReferenceContext: boolean;
}): MediaGenerationDependencySlot[] {
  const slots = declareShotVideoTakeDependencySlots({
    target: input.context.target,
    inputModeId: input.inputModeId,
    selectedCast: input.context.selectedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
      isVoiceOver: castMember.isVoiceOver,
    })),
    selectedCharacterSheetAssetIdsByCastMember: selectedCharacterSheetAssetIdsByCastMember(
      input.context
    ),
    selectedLocations: input.context.selectedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: input.context.activeLookbook
      ? {
          id: input.context.activeLookbook.id,
          name: input.context.activeLookbook.name,
          selectedSheetId:
            [...selectedLookbookSheetIdsForGenerationTakeState(
              input.context.take.state,
              input.context.take.shotIds
            )][0] ?? null,
        }
      : null,
    customReferenceInputs: input.context.mediaInputs
      .filter((mediaInput) => mediaInput.kind === 'reference-image')
      .map((mediaInput) => ({
        id: mediaInput.subjectId || mediaInput.assetId,
        title: mediaInput.title,
      })),
    selectedLocationSheetAssetIdsByLocation: selectedLocationSheetAssetIdsByLocation(
      input.context
    ),
    requestedInputs: input.context.take.state.production.requestedInputs,
    requiresVideoPromptSheet: input.context.shotGroupMode === 'multi-shot',
    videoPromptSheetRequired: routeRequiresVideoPromptSheet(input.route),
  });
  if (input.includeReferenceContext) {
    return slots;
  }
  return slots.filter((slot) => slot.selector.kind === 'shot-video-input');
}



export function shotVideoTakeReferenceDependencySlotsForContext(
  input: {
    session: DatabaseSession;
    context: ShotVideoTakeProductionContext;
  }
): MediaGenerationDependencySlot[] {
  return declareShotVideoTakeDependencySlots({
    target: input.context.target,
    inputModeId: 'text-only',
    selectedCast: input.context.selectedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
      isVoiceOver: castMember.isVoiceOver,
    })),
    selectedCharacterSheetAssetIdsByCastMember: selectedCharacterSheetAssetIdsByCastMember(
      input.context
    ),
    selectedLocations: input.context.selectedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: input.context.activeLookbook
      ? {
          id: input.context.activeLookbook.id,
          name: input.context.activeLookbook.name,
          selectedSheetId:
            [...selectedLookbookSheetIdsForGenerationTakeState(
              input.context.take.state,
              input.context.take.shotIds
            )][0] ?? null,
        }
      : null,
    customReferenceInputs: [],
    selectedLocationSheetAssetIdsByLocation: selectedLocationSheetAssetIdsByLocation(
      input.context
    ),
    requestedInputs: [],
  });
}

export function shotVideoTakeDialogueAudioDependencySlots(input: {
  context: ShotVideoTakeProductionContext;
  references: ResolvedShotDialogueAudioReference[];
}): MediaGenerationDependencySlot[] {
  return input.references.map((reference) => ({
    dependencyId: reference.dependencyId,
    dependencyKind: 'reference-audio',
    label: `${reference.speakerName} dialogue audio`,
    dependencyTarget: {
      kind: 'sceneDialogue',
      sceneId: input.context.scene.id,
      dialogueId: reference.dialogueId,
    },
    selector: {
      kind: 'shot-video-input',
      inputKind: 'audio',
      takeId: input.context.target.takeId,
      shotIds: input.context.target.shotIds,
      subjectKind: 'scene-dialogue',
      subjectId: reference.dialogueId,
    },
    required: false,
    defaultIncluded: reference.defaultIncluded,
    reason:
      'This selected dialogue audio reference helps the video model align voice and performance.',
  }));
}



export async function declareShotVideoTakeDependencies(
  input: MediaGenerationDependencyDeclarationInput
): Promise<MediaGenerationDependencySlot[]> {
  if (input.target.kind !== 'sceneShotVideoTake') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_TARGET_INVALID',
      `shot.video-take dependencies require a sceneShotVideoTake target. Received: ${input.target.kind}.`
    );
  }
  if (input.request.kind !== 'media-generation-spec') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_REQUEST_INVALID',
      `shot.video-take dependencies require a media-generation-spec request. Received: ${input.request.kind}.`
    );
  }
  const spec = input.request.spec as ShotVideoTakeOutputGenerationSpec | undefined;
  if (spec?.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_SPEC_INVALID',
      'shot.video-take dependencies require a shot video take output generation spec.'
    );
  }
  const target = input.target;
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input: {
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: target.sceneId,
        takeId: target.takeId,
      },
    });
    const context = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
    return declareShotVideoTakeDependencySlots({
      target: context.target,
      inputModeId: spec.inputModeId,
      selectedCast: context.selectedCast.map((castMember) => ({
        id: castMember.id,
        name: castMember.name,
        isVoiceOver: castMember.isVoiceOver,
      })),
      selectedCharacterSheetAssetIdsByCastMember: selectedCharacterSheetAssetIdsByCastMember(
        context
      ),
      selectedLocations: context.selectedLocations.map((location) => ({
        id: location.id,
        name: location.name,
      })),
      activeLookbook: context.activeLookbook
        ? {
            id: context.activeLookbook.id,
            name: context.activeLookbook.name,
            selectedSheetId:
              [...selectedLookbookSheetIdsForGenerationTakeState(
                context.take.state,
                context.take.shotIds
              )][0] ?? null,
          }
        : null,
      customReferenceInputs: spec.inputs
        .filter((generationInput) => generationInput.kind === 'reference-image')
        .map((generationInput) => ({
          id: generationInput.subjectId ?? generationInput.assetId,
          title: generationInput.role || 'Reference image',
        })),
      selectedLocationSheetAssetIdsByLocation: selectedLocationSheetAssetIdsByLocation(
        context
      ),
      requiresVideoPromptSheet: context.shotGroupMode === 'multi-shot',
      videoPromptSheetRequired: routeRequiresVideoPromptSheet(
        requireShotVideoTakeRoute(
          spec.modelChoice,
          spec.inputModeId,
          context.shotGroupMode
        )
      ),
    });
  });
}

function routeRequiresVideoPromptSheet(route: ShotVideoRoute): boolean {
  return route.inputSlots.some(
    (slot) => slot.kind === 'video-prompt-sheet' && slot.required
  );
}

function selectedLocationSheetAssetIdsByLocation(
  context: ShotVideoTakeProductionContext
): Record<string, string[]> {
  return Object.fromEntries(
    context.selectedLocations.map((location) => [
      location.id,
      selectedLocationSheetAssetIdsForGenerationTakeState(
        context.take.state,
        context.take.shotIds,
        location.id
      ),
    ])
  );
}

function selectedCharacterSheetAssetIdsByCastMember(
  context: ShotVideoTakeProductionContext
): Record<string, string[]> {
  return Object.fromEntries(
    context.selectedCast.map((castMember) => [
      castMember.id,
      selectedCharacterSheetAssetIdsForGenerationTakeState(
        context.take.state,
        context.take.shotIds,
        castMember.id
      ),
    ])
  );
}



export function finalEstimateFromDependencyInventory(
  dependencyInventory: MediaGenerationDependencyInventory
): ShotVideoTakePreflightReport['estimate'] {
  return (dependencyInventory as MediaGenerationDependencyInventory & {
    finalEstimate?: ShotVideoTakePreflightReport['estimate'];
  }).finalEstimate ?? null;
}



export function inputPolicyMode(
  policy: ShotVideoTakeInputPolicy,
  slotKey: string
): 'reuse-selected' | 'regenerate' | 'auto' {
  return policy.slotModes?.[slotKey] ?? policy.defaultMode;
}



export function preparedInputMatchesSlot(
  input: ShotVideoTakePreflightInput,
  slot: MediaGenerationDependencySlot
): boolean {
  if (slot.selector.kind === 'shot-video-input') {
    return (
      input.kind === slot.selector.inputKind &&
      (!slot.selector.subjectKind ||
        input.subjectKind === slot.selector.subjectKind) &&
      (!slot.selector.subjectId || input.subjectId === slot.selector.subjectId)
    );
  }
  if (slot.selector.kind === 'asset-relationship') {
    if (
      slot.selector.target.kind === 'castMember' &&
      input.kind === 'character-sheet'
    ) {
      return (
        input.subjectKind === 'cast-member' &&
        input.subjectId === slot.selector.target.castMemberId
      );
    }
    if (
      slot.selector.target.kind === 'location' &&
      input.kind === 'location-sheet'
    ) {
      return (
        input.subjectKind === 'location' &&
        input.subjectId === slot.selector.target.locationId
      );
    }
    return false;
  }
  if (slot.selector.kind === 'lookbook-sheet') {
    return (
      input.kind === 'lookbook-sheet' &&
      input.subjectKind === 'lookbook' &&
      input.subjectId === slot.selector.lookbookId
    );
  }
  return false;
}
