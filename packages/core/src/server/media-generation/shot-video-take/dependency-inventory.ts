import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeGenerationProduction,
  ShotVideoTakePreflightInput,
  ShotVideoTakeInputPolicy,
  MediaGenerationDependencyInventory,
  ShotVideoTakePreflightReport,
  MediaGenerationDependencySlot,
  ShotVideoTakeGenerationSpec,
  MediaGenerationDependencyPricing,
} from '../../../client/index.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  readScreenplaySceneFromSession,
} from '../../database/access/screenplay-resource.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import {
  planMediaGenerationDependencyInventory,
} from '../dependency-inventory.js';
import type {
  MediaGenerationDependencyRootEstimate,
} from '../dependency-inventory.js';
import {
  resolveMediaGenerationDependencySelection,
} from '../dependency-selectors.js';
import type {
  MediaGenerationDependencyDeclarationInput,
} from '../purpose-registry.js';
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
  buildShotVideoTakeContext,
} from './context.js';
import {
  ShotVideoTakeDependencyRequest,
} from './dependency-draft-specs.js';
import {
  issue,
} from './diagnostics.js';
import {
  resolveShotDialogueAudioReferences,
} from './dialogue-audio-references.js';
import type {
  ResolvedShotDialogueAudioReference,
} from './dialogue-audio-references.js';
import {
  validateFinalPricingSpecAgainstContext,
} from './final-specs.js';
import {
  finalTakeSpecForPreflight,
} from './preflight-report.js';
import {
  buildShotVideoTakePricingProviderPayload,
  toGenerationRequest,
} from './provider-payloads.js';
import {
  isShotInputPurpose,
} from './purpose-config.js';
import {
  filterPreparedInputsByReferenceInclusions,
  referenceInclusionForDependencyId,
  referenceDependencySlotIncluded,
  validateRequiredReferenceInclusions,
} from './reference-inclusions.js';
import {
  selectedLookbookSheetIdsForShots,
} from './reference-selection.js';
import {
  requireScreenplayDocument,
} from './project-session.js';



export async function buildShotVideoTakeDependencyInventory(input: {
  session: DatabaseSession;
  projectName?: string;
  homeDir?: string;
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  route: ShotVideoRoute;
  normalizedSettings: NonNullable<ShotVideoTakeGenerationProduction['parameterValues']>;
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
      if (dialogueAudioReference?.audioState === 'no-picked-take' ||
        dialogueAudioReference?.audioState === 'multiple-picked-takes' ||
        dialogueAudioReference?.audioState === 'missing-file') {
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
      isShotInputPurpose(purpose)
        ? shotVideoTakeReferenceDependencySlotsForContext(input.context).filter((slot) =>
            referenceDependencySlotIncluded(input.context, slot)
          )
        : [],
    estimateRoot: async (): Promise<MediaGenerationDependencyRootEstimate> => {
      const finalPricing = await estimateFinalPlanLine({
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
  context: ShotVideoTakeGenerationContext;
  references: ResolvedShotDialogueAudioReference[];
  diagnostics: DiagnosticIssue[];
}): void {
  const selectedCount = input.references.filter((reference) =>
    referenceInclusionForDependencyId(
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
        { path: ['takeGeneration', 'production', 'modelChoice'] },
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
        { path: ['takeGeneration', 'production', 'requestedInputs'] },
        `Select ${audioSlot.maxCount} or fewer dialogue audio references for this model route.`
      )
    );
  }
}



export function shotVideoTakeDependencySlotsForContext(input: {
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  route: ShotVideoRoute;
  includeReferenceContext: boolean;
}): MediaGenerationDependencySlot[] {
  const slots = declareShotVideoTakeDependencySlots({
    target: input.context.target,
    inputModeId: input.inputModeId,
    selectedCast: input.context.referencedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
      isVoiceOver: castMember.isVoiceOver,
    })),
    selectedLocations: input.context.referencedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: input.context.activeLookbook
      ? {
          id: input.context.activeLookbook.id,
          name: input.context.activeLookbook.name,
          selectedSheetId:
            [...selectedLookbookSheetIdsForShots(input.context.shots)][0] ?? null,
        }
      : null,
    customReferenceInputs: input.context.availableInputs
      .filter((availableInput) => availableInput.kind === 'reference-image')
      .map((availableInput) => ({
        id: availableInput.subjectId || availableInput.assetId,
        title: availableInput.title,
      })),
    requestedInputs: input.context.takeGeneration.production.requestedInputs,
    requiresMultiShotStoryboardSheet: input.context.shotGroupMode === 'multi-shot',
  });
  if (input.includeReferenceContext) {
    return slots;
  }
  return slots.filter((slot) => slot.selector.kind === 'shot-video-input');
}



export function shotVideoTakeReferenceDependencySlotsForContext(
  context: ShotVideoTakeGenerationContext
): MediaGenerationDependencySlot[] {
  return declareShotVideoTakeDependencySlots({
    target: context.target,
    inputModeId: 'text-only',
    selectedCast: context.referencedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
      isVoiceOver: castMember.isVoiceOver,
    })),
    selectedLocations: context.referencedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: context.activeLookbook
      ? {
          id: context.activeLookbook.id,
          name: context.activeLookbook.name,
          selectedSheetId: [...selectedLookbookSheetIdsForShots(context.shots)][0] ?? null,
        }
      : null,
    customReferenceInputs: [],
    requestedInputs: [],
  });
}

export function shotVideoTakeDialogueAudioDependencySlots(input: {
  context: ShotVideoTakeGenerationContext;
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
      takeGenerationId: input.context.target.takeGenerationId,
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
  if (input.target.kind !== 'sceneShotVideoTakeGeneration') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_TARGET_INVALID',
      `shot.video-take dependencies require a sceneShotVideoTakeGeneration target. Received: ${input.target.kind}.`
    );
  }
  if (input.request.kind !== 'media-generation-spec') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_REQUEST_INVALID',
      `shot.video-take dependencies require a media-generation-spec request. Received: ${input.request.kind}.`
    );
  }
  const spec = input.request.spec as ShotVideoTakeGenerationSpec | undefined;
  if (spec?.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_SPEC_INVALID',
      'shot.video-take dependencies require a shot.video-take generation spec.'
    );
  }
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeGenerationId: input.target.takeGenerationId,
  });
  return declareShotVideoTakeDependencySlots({
    target: context.target,
    inputModeId: spec.inputModeId,
    selectedCast: context.referencedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
      isVoiceOver: castMember.isVoiceOver,
    })),
    selectedLocations: context.referencedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: context.activeLookbook
      ? {
          id: context.activeLookbook.id,
          name: context.activeLookbook.name,
          selectedSheetId: [...selectedLookbookSheetIdsForShots(context.shots)][0] ?? null,
        }
      : null,
    customReferenceInputs: spec.inputs
      .filter((generationInput) => generationInput.kind === 'reference-image')
      .map((generationInput) => ({
        id: generationInput.subjectId ?? generationInput.assetId,
        title: generationInput.role || 'Reference image',
      })),
    requiresMultiShotStoryboardSheet: context.shotGroupMode === 'multi-shot',
  });
}



export function finalEstimateFromDependencyInventory(
  dependencyInventory: MediaGenerationDependencyInventory
): ShotVideoTakePreflightReport['estimate'] {
  return (dependencyInventory as MediaGenerationDependencyInventory & {
    finalEstimate?: ShotVideoTakePreflightReport['estimate'];
  }).finalEstimate ?? null;
}



export async function estimateFinalPlanLine(input: {
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  normalizedSettings: NonNullable<ShotVideoTakeGenerationProduction['parameterValues']>;
  preparedInputs: ShotVideoTakePreflightInput[];
  diagnostics: DiagnosticIssue[];
}): Promise<{
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
  estimate: ShotVideoTakePreflightReport['estimate'];
}> {
  try {
    const spec = finalTakeSpecForPreflight({
      context: input.context,
      inputModeId: input.inputModeId,
      modelChoice: input.modelChoice,
      preparedInputs: input.preparedInputs,
      parameterValues: input.normalizedSettings,
      promptMode: 'estimate-placeholder',
    });
    validateFinalPricingSpecAgainstContext(spec, input.context);
    const plan = buildShotVideoTakePricingProviderPayload({
      spec,
      context: input.context,
    });
    const { estimateGeneration } = await import('@gorenku/studio-engines');
    const estimate = await estimateGeneration(toGenerationRequest(plan, spec));
    if (estimate.estimatedCostUsd === null) {
      return {
        pricing: {
          state: 'unpriced',
          estimatedUsd: null,
          reason: estimate.warnings.join(' ') || 'No pricing is configured for the final video route.',
          overrideRequired: true,
        },
        diagnostics: [
          issue(
            'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
            'Final video generation is unpriced.',
            ['dependencyInventory', 'rootGeneration'],
            'Approve an explicit unpriced-cost override before running.'
          ),
        ],
        estimate,
      };
    }
    return {
      pricing: { state: 'priced', estimatedUsd: estimate.estimatedCostUsd },
      diagnostics: [],
      estimate,
    };
  } catch (error) {
    const message = error instanceof Error
      ? `Final video estimate failed: ${error.message}`
      : 'Final video estimate failed.';
    const diagnostic = issue(
      'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
      message,
      ['dependencyInventory', 'rootGeneration'],
      'Review the selected model, route settings, and prepared inputs.'
    );
    input.diagnostics.push(diagnostic);
    return {
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: message,
        overrideRequired: true,
      },
      diagnostics: [diagnostic],
      estimate: null,
    };
  }
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
