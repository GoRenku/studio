import {
  buildDiagnosticResult,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  SceneShotVideoTake,
  SceneShotVideoTakeAuthoringApplyReport,
  SceneShotVideoTakeAuthoringContextReport,
  SceneShotVideoTakeAuthoringDocument,
  SceneShotVideoTakeAuthoringSnapshot,
  SceneShotVideoTakeAuthoringValidationReport,
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeState,
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionContext,
  ShotVideoTakeProviderPayloadPreview,
  ShotVideoTakeGenerationReadiness,
  ShotVideoTakeGenerationReadinessBlocker,
  ShotVideoInputReferenceMode,
  ShotVideoInputReferenceReport,
} from '../../../client/index.js';
import {
  applySceneShotVideoTakeAuthoringRecord,
} from '../../database/access/scene-shot-video-takes.js';
import {
  readLookbookSheetRecord,
} from '../../database/access/lookbook-sheets.js';
import {
  readSceneDialogueAudioRecord,
  readSceneDialogueAudioTakeRecord,
} from '../../database/access/scene-dialogue-audio.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  ApplySceneShotVideoTakeAuthoringDocumentInput,
  ReadSceneShotVideoTakeAuthoringContextInput,
  ValidateSceneShotVideoTakeAuthoringDocumentInput,
} from '../../project-data-service-contracts.js';
import {
  assertSceneShotVideoTakeAuthoringDocument,
} from '../../shot-video-take-json/validator.js';
import {
  assetsForTarget,
} from './reference-card-plans.js';
import {
  buildContextFromPrepared,
  buildShotVideoTakeContext,
} from './context.js';
import {
  prepareShotVideoTakeDraftSpec,
} from './final-specs.js';
import {
  buildAgentMediaReport,
} from '../shared-generation-service.js';
import {
  finalTakeSpecForPreflight,
  previewShotVideoTakeProductionForContext,
} from './preflight-report.js';
import {
  buildShotVideoTakeProductionPlanReport,
  planShotVideoTakeProductionForContext,
} from './production-plan.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  sceneNarrativeReferenceScope,
} from './reference-scope.js';
import {
  assertEditableSceneShotVideoTake,
  type PreparedSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
  sceneShotVideoTakeTarget,
} from './take-context.js';
import {
  normalizeSceneShotVideoTakeShotMembership,
} from './take-shot-membership.js';
import {
  sceneShotVideoTakeDirectionReferenceSelections,
  validateSceneShotVideoTakeStructure,
} from './take-state.js';
import {
  resolveShotVideoInputReferenceBundle,
} from './shot-input-references.js';

export async function readSceneShotVideoTakeAuthoringContext(
  input: ReadSceneShotVideoTakeAuthoringContextInput
): Promise<SceneShotVideoTakeAuthoringContextReport> {
  const context = await buildShotVideoTakeContext(input);
  const snapshot = await buildSceneShotVideoTakeAuthoringSnapshot({
    input,
    context,
    selectedShotId: input.selectedShotId,
  });
  return {
    kind: 'sceneShotVideoTakeAuthoringContext',
    ...snapshot,
  };
}

export async function validateSceneShotVideoTakeAuthoringDocument(
  input: ValidateSceneShotVideoTakeAuthoringDocumentInput
): Promise<SceneShotVideoTakeAuthoringValidationReport> {
  const proposal = await prepareSceneShotVideoTakeAuthoringProposal(input);
  const prior = await buildSceneShotVideoTakeAuthoringSnapshot({
    input,
    context: proposal.priorContext,
  });
  const current = await buildSceneShotVideoTakeAuthoringSnapshot({
    input,
    context: proposal.currentContext,
  });
  return {
    valid: true,
    document: current.document,
    prior,
    current,
    warnings: [],
  };
}

export async function applySceneShotVideoTakeAuthoringDocument(
  input: ApplySceneShotVideoTakeAuthoringDocumentInput
): Promise<SceneShotVideoTakeAuthoringApplyReport> {
  const proposal = await prepareSceneShotVideoTakeAuthoringProposal(input);
  const prior = await buildSceneShotVideoTakeAuthoringSnapshot({
    input,
    context: proposal.priorContext,
  });
  const applied = await withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input: {
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: proposal.document.sceneId,
        takeId: proposal.document.takeId,
      },
    });
    assertEditableSceneShotVideoTake(prepared.take);
    if (
      proposal.document.baseTakeUpdatedAt &&
      prepared.take.updatedAt !== proposal.document.baseTakeUpdatedAt
    ) {
      throwAuthoringError([
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_STALE_CONTEXT',
          'Scene Shot Video Take changed after the authoring context was read.',
          ['baseTakeUpdatedAt'],
          'Re-read the authoring context and apply a fresh proposal.'
        ),
      ]);
    }
    const take = applySceneShotVideoTakeAuthoringRecord(session, {
      takeId: proposal.document.takeId,
      shotIds: proposal.document.shotIds,
      state: proposal.state,
      screenplay,
      now: new Date().toISOString(),
    });
    const currentPrepared = preparedTakeWithTake({ prepared, take });
    return {
      project: {
        id: project.id,
        name: project.name,
        projectFolder,
      },
      context: buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: currentPrepared,
      }),
    };
  });
  const current = await buildSceneShotVideoTakeAuthoringSnapshot({
    input,
    context: applied.context,
  });
  return {
    valid: true,
    document: current.document,
    project: applied.project,
    prior,
    current,
    resourceKeys: current.resourceKeys,
  };
}

async function prepareSceneShotVideoTakeAuthoringProposal(
  input:
    | ValidateSceneShotVideoTakeAuthoringDocumentInput
    | ApplySceneShotVideoTakeAuthoringDocumentInput
): Promise<{
  document: SceneShotVideoTakeAuthoringDocument;
  priorContext: ShotVideoTakeProductionContext;
  currentContext: ShotVideoTakeProductionContext;
  state: SceneShotVideoTakeState;
}> {
  assertSceneShotVideoTakeAuthoringDocument({ document: input.document });
  const document = input.document;
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input: {
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: document.sceneId,
        takeId: document.takeId,
      },
    });
    const issues: DiagnosticIssue[] = [];
    if (!document.baseTakeUpdatedAt) {
      issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_STALE_CONTEXT',
          'Authoring document must include the base take updated timestamp.',
          ['baseTakeUpdatedAt'],
          'Read the authoring context and use its baseTakeUpdatedAt value before validating or applying a proposal.'
        )
      );
    }
    if (document.sceneId !== prepared.take.sceneId) {
      issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_TARGET_MISMATCH',
          'Authoring document sceneId does not match the target take.',
          ['sceneId'],
          'Refresh the authoring context and use the scene id from the current take.'
        )
      );
    }
    if (document.sourceShotListId !== prepared.take.sourceShotListId) {
      issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_TARGET_MISMATCH',
          'Authoring document sourceShotListId does not match the target take.',
          ['sourceShotListId'],
          'Refresh the authoring context and use the source shot list id from the current take.'
        )
      );
    }
    if (
      document.baseTakeUpdatedAt &&
      document.baseTakeUpdatedAt !== prepared.take.updatedAt
    ) {
      issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_STALE_CONTEXT',
          'Scene Shot Video Take changed after the authoring context was read.',
          ['baseTakeUpdatedAt'],
          'Re-read the authoring context and apply a fresh proposal.'
        )
      );
    }
    const normalizedMembership = normalizeSceneShotVideoTakeShotMembership({
      shots: prepared.shotList.shots,
      shotIds: document.shotIds,
    });
    issues.push(...normalizedMembership.issues);
    const normalizedDocument: SceneShotVideoTakeAuthoringDocument = {
      ...document,
      shotIds:
        normalizedMembership.issues.length === 0
          ? normalizedMembership.shotIds
          : [...document.shotIds],
    };
    const state: SceneShotVideoTakeState = {
      version: 2,
      structure: normalizedDocument.structure,
      production: normalizedDocument.production,
      ...(prepared.take.state.promptState
        ? { promptState: prepared.take.state.promptState }
        : {}),
    };
    validateStructure({ state, shotIds: normalizedDocument.shotIds, issues });
    throwAuthoringError(issues);
    const priorContext = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
    const currentPrepared = proposedPreparedTake({
      prepared,
      document: normalizedDocument,
      state,
    });
    const currentContext = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared: currentPrepared,
    });
    validateDirectionReferences({
      session,
      context: currentContext,
      document: normalizedDocument,
      issues,
    });
    throwAuthoringError(issues);
    await validateProductionPlan({
      context: currentContext,
      input,
      issues,
    });
    throwAuthoringError(issues);
    return {
      document: normalizedDocument,
      priorContext,
      currentContext,
      state,
    };
  });
}

function proposedPreparedTake(input: {
  prepared: PreparedSceneShotVideoTake;
  document: SceneShotVideoTakeAuthoringDocument;
  state: SceneShotVideoTakeState;
}): PreparedSceneShotVideoTake {
  const take: SceneShotVideoTake = {
    ...input.prepared.take,
    sceneId: input.document.sceneId,
    sourceShotListId: input.document.sourceShotListId,
    shotIds: [...input.document.shotIds],
    state: input.state,
  };
  return {
    ...input.prepared,
    take,
    orderedShotIds: [...input.document.shotIds],
    target: sceneShotVideoTakeTarget(take),
  };
}

function preparedTakeWithTake(input: {
  prepared: PreparedSceneShotVideoTake;
  take: SceneShotVideoTake;
}): PreparedSceneShotVideoTake {
  return {
    ...input.prepared,
    take: input.take,
    orderedShotIds: [...input.take.shotIds],
    target: sceneShotVideoTakeTarget(input.take),
  };
}

function authoringDocumentForTake(
  take: SceneShotVideoTake
): SceneShotVideoTakeAuthoringDocument {
  return {
    kind: 'sceneShotVideoTakeAuthoring',
    takeId: take.takeId,
    sceneId: take.sceneId,
    sourceShotListId: take.sourceShotListId,
    baseTakeUpdatedAt: take.updatedAt,
    shotIds: [...take.shotIds],
    structure: take.state.structure,
    production: take.state.production,
  };
}

async function buildSceneShotVideoTakeAuthoringSnapshot(input: {
  input:
    | ReadSceneShotVideoTakeAuthoringContextInput
    | ValidateSceneShotVideoTakeAuthoringDocumentInput
    | ApplySceneShotVideoTakeAuthoringDocumentInput;
  context: ShotVideoTakeProductionContext;
  selectedShotId?: string;
}): Promise<SceneShotVideoTakeAuthoringSnapshot> {
  const selectedShotId = resolveAuthoringReportSelectedShotId({
    context: input.context,
    selectedShotId: input.selectedShotId,
  });
  return withShotProjectSession(input.input, async ({ session }) => {
    const plan = await planShotVideoTakeProductionForContext({
      context: input.context,
      projectName: input.input.projectName,
      homeDir: input.input.homeDir,
    });
    const productionPlan = buildShotVideoTakeProductionPlanReport({
      session,
      context: input.context,
      plan,
      selectedShotId,
    });
    const preflight = await previewShotVideoTakeProductionForContext({
      context: input.context,
      projectName: input.input.projectName,
      homeDir: input.input.homeDir,
    });
    const takeGenerationReadiness = buildTakeGenerationReadiness({
      context: input.context,
      preflight,
    });
    return {
      document: authoringDocumentForTake(input.context.take),
      context: input.context,
      productionPlan,
      preflight,
      takeGenerationReadiness,
      agentMedia: await buildAgentMediaReport({
        homeDir: input.input.homeDir,
        mediaKind: 'image',
      }),
      shotVideoInputReferences: buildShotVideoInputReferenceReport({
        session,
        context: input.context,
      }),
      providerPreview: await previewProviderPayload({
        input: {
          projectName: input.input.projectName,
          homeDir: input.input.homeDir,
          takeId: input.context.take.takeId,
          sceneId: input.context.scene.id,
          selectedShotId,
        },
        context: input.context,
        preflight,
      }),
      resourceKeys: input.context.resourceKeys,
    };
  });
}

function buildShotVideoInputReferenceReport(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
}): ShotVideoInputReferenceReport {
  const modes: ShotVideoInputReferenceMode[] = [
    'movie-lookbook',
    'storyboard-lookbook',
  ];
  const resolutions = modes.map((referenceMode) => {
    try {
      const bundle = resolveShotVideoInputReferenceBundle({
        session: input.session,
        context: input.context,
        purpose: 'shot.first-frame',
        referenceMode,
      });
      return {
        referenceMode,
        available: true,
        bundle,
      };
    } catch (error) {
      return {
        referenceMode,
        available: false,
        unavailableReason:
          error instanceof Error
            ? error.message
            : 'Reference mode is unavailable.',
      };
    }
  });
  const movieResolution = resolutions.find(
    (resolution) => resolution.referenceMode === 'movie-lookbook'
  );
  return {
    defaultReferenceMode: 'movie-lookbook',
    availableReferenceModes: resolutions.map((resolution) => ({
      referenceMode: resolution.referenceMode,
      available: resolution.available,
      ...(resolution.unavailableReason
        ? { unavailableReason: resolution.unavailableReason }
        : {}),
    })),
    ...(movieResolution?.available && movieResolution.bundle
      ? {
          defaultReferenceBundle: {
            ...(movieResolution.bundle.styleReference
              ? {
                  styleReference: {
                    role: movieResolution.bundle.styleReference.role,
                    label: movieResolution.bundle.styleReference.label,
                    assetId: movieResolution.bundle.styleReference.assetId,
                  },
                }
              : {}),
            continuityReferences:
              movieResolution.bundle.continuityReferences.map((reference) => ({
                role: reference.role,
                label: reference.label,
                assetId: reference.assetId,
              })),
          },
        }
      : {}),
  };
}

function resolveAuthoringReportSelectedShotId(input: {
  context: ShotVideoTakeProductionContext;
  selectedShotId?: string;
}): string | undefined {
  if (input.context.take.state.structure.mode === 'continuous') {
    if (input.selectedShotId) {
      throw new ProjectDataError(
        'CORE_SHOT_VIDEO_TAKE_AUTHORING_SELECTED_SHOT_UNSUPPORTED',
        'Continuous authoring reports do not use a selected shot.',
        {
          issues: [
            issue(
              'CORE_SHOT_VIDEO_TAKE_AUTHORING_SELECTED_SHOT_UNSUPPORTED',
              'Continuous authoring reports do not use a selected shot.',
              ['selectedShotId'],
              'Omit selectedShotId for continuous takes.'
            ),
          ],
          suggestion: 'Omit selectedShotId for continuous takes.',
        }
      );
    }
    return undefined;
  }
  return input.selectedShotId ?? input.context.take.shotIds[0];
}

function validateStructure(input: {
  state: SceneShotVideoTakeState;
  shotIds: string[];
  issues: DiagnosticIssue[];
}): void {
  try {
    validateSceneShotVideoTakeStructure({
      state: input.state,
      shotIds: input.shotIds,
    });
  } catch (error) {
    if (error instanceof ProjectDataError) {
      input.issues.push(...error.issues);
      return;
    }
    throw error;
  }
}

function validateDirectionReferences(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  document: SceneShotVideoTakeAuthoringDocument;
  issues: DiagnosticIssue[];
}): void {
  const screenplay = requireScreenplayDocument(input.session);
  const narrativeScope = sceneNarrativeReferenceScope({
    session: input.session,
    screenplay,
    sceneId: input.document.sceneId,
  });
  const sceneCastMemberIds = new Set(
    narrativeScope.castMembers.flatMap((castMember) =>
      castMember.id ? [castMember.id] : []
    )
  );
  const sceneLocationIds = new Set(
    narrativeScope.locations.flatMap((location) =>
      location.id ? [location.id] : []
    )
  );
  for (const entry of directionEntries(input.document)) {
    const referenceSelections =
      sceneShotVideoTakeDirectionReferenceSelections(entry.direction);
    Object.entries(referenceSelections.selectedCharacterSheetAssetIds).forEach(
      ([castMemberId, assetId]) => {
        if (!sceneCastMemberIds.has(castMemberId)) {
          input.issues.push(
            issue(
              'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE',
              `Character Sheet selection targets a Cast Member outside this scene: ${castMemberId}.`,
              [...entry.path, 'referenceSelections', 'selectedCharacterSheetAssetIds', castMemberId],
              'Select Character Sheets only for Cast Members in this scene reference scope.'
            )
          );
        }
        if (!hasAsset(input.session, { kind: 'castMember', castMemberId }, 'character_sheet', assetId)) {
          input.issues.push(
            issue(
              'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE',
              `Character Sheet asset does not belong to the selected Cast Member: ${assetId}.`,
              [...entry.path, 'referenceSelections', 'selectedCharacterSheetAssetIds', castMemberId],
              'Choose a Character Sheet asset attached to that Cast Member.'
            )
          );
        }
      }
    );
    Object.entries(referenceSelections.selectedLocationSheetAssetIds).forEach(
      ([locationId, assetId]) => {
        if (!sceneLocationIds.has(locationId)) {
          input.issues.push(
            issue(
              'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE',
              `Location Sheet selection targets a Location outside this scene: ${locationId}.`,
              [...entry.path, 'referenceSelections', 'selectedLocationSheetAssetIds', locationId],
              'Select Location Sheets only for Locations in this scene reference scope.'
            )
          );
        }
        if (!hasAsset(input.session, { kind: 'location', locationId }, 'environment_sheet', assetId)) {
          input.issues.push(
            issue(
              'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE',
              `Location Sheet asset does not belong to the selected Location: ${assetId}.`,
              [...entry.path, 'referenceSelections', 'selectedLocationSheetAssetIds', locationId],
              'Choose a Location Sheet asset attached to that Location.'
            )
          );
        }
      }
    );
    referenceSelections.selectedLookbookSheetIds.forEach((lookbookSheetId, index) => {
      const sheet = readLookbookSheetRecord(input.session, lookbookSheetId);
      if (!sheet || input.context.activeLookbook?.id !== sheet.lookbookId) {
        input.issues.push(
          issue(
            'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE',
            `Lookbook sheet does not belong to the active Lookbook: ${lookbookSheetId}.`,
            [...entry.path, 'referenceSelections', 'selectedLookbookSheetIds', String(index)],
            'Choose a sheet from the active Movie Lookbook.'
          )
        );
      }
    });
    Object.entries(referenceSelections.selectedDialogueAudioTakeIds).forEach(
      ([dialogueId, dialogueAudioTakeId]) => {
        const audio = readSceneDialogueAudioRecord(input.session, {
          sceneId: input.document.sceneId,
          dialogueId,
        });
        const take = audio
          ? readSceneDialogueAudioTakeRecord(input.session, {
              sceneDialogueAudioId: audio.id,
              takeId: dialogueAudioTakeId,
            })
          : null;
        if (!take) {
          input.issues.push(
            issue(
              'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE',
              `Dialogue audio take does not belong to the selected scene dialogue: ${dialogueAudioTakeId}.`,
              [...entry.path, 'referenceSelections', 'selectedDialogueAudioTakeIds', dialogueId],
              'Choose a dialogue audio take generated for that scene dialogue.'
            )
          );
        }
      }
    );
  }
}

async function validateProductionPlan(input: {
  context: ShotVideoTakeProductionContext;
  input:
    | ValidateSceneShotVideoTakeAuthoringDocumentInput
    | ApplySceneShotVideoTakeAuthoringDocumentInput;
  issues: DiagnosticIssue[];
}): Promise<void> {
  try {
    await planShotVideoTakeProductionForContext({
      context: input.context,
      projectName: input.input.projectName,
      homeDir: input.input.homeDir,
    });
  } catch (error) {
    if (error instanceof ProjectDataError) {
      input.issues.push(...error.issues);
      return;
    }
    throw error;
  }
}

async function previewProviderPayload(input: {
  input: ReadSceneShotVideoTakeAuthoringContextInput;
  context: ShotVideoTakeProductionContext;
  preflight: ShotVideoTakePreflightReport;
}): Promise<ShotVideoTakeProviderPayloadPreview> {
  try {
    const spec = finalTakeSpecForPreflight({
      context: input.context,
      inputModeId: input.preflight.inputModeId,
      modelChoice: input.preflight.modelChoice,
      preparedInputs: input.preflight.preparedInputs,
    });
    const prepared = await prepareShotVideoTakeDraftSpec({
      projectName: input.input.projectName,
      homeDir: input.input.homeDir,
      spec,
    });
    return {
      available: true,
      issues: [],
      spec,
      providerPayload: prepared.providerPayload,
      generation: prepared.generation,
    };
  } catch (error) {
    if (error instanceof ProjectDataError) {
      return {
        available: false,
        issues:
          error.issues.length > 0
            ? error.issues
            : [
                issue(
                  'CORE_SHOT_VIDEO_TAKE_AUTHORING_PROVIDER_PREVIEW_UNAVAILABLE',
                  error.message,
                  ['providerPreview'],
                  error.suggestion ??
                    'Complete final prompt and required prepared inputs before reviewing the provider payload.'
                ),
              ],
      };
    }
    throw error;
  }
}

function buildTakeGenerationReadiness(input: {
  context: ShotVideoTakeProductionContext;
  preflight: ShotVideoTakePreflightReport;
}): ShotVideoTakeGenerationReadiness {
  const requiredBlockers = [
    ...missingChoiceBlockers(input.preflight),
    ...missingDependencyBlockers(input.preflight),
    ...missingFinalPromptBlockers(input.context),
  ];
  const userDirectionNeeded =
    requiredBlockers.length > 0
      ? []
      : userDirectionQuestions(input.context);
  const status =
    requiredBlockers.length > 0
      ? 'blocked'
      : userDirectionNeeded.length > 0
        ? 'needs-user-direction'
        : input.preflight.finalTake.canCreateSpec
          ? 'ready-to-estimate'
          : 'blocked';
  return {
    status,
    requiredBlockers,
    userDirectionNeeded,
    optionalImprovements: optionalReadinessImprovements(input.context),
  };
}

function missingChoiceBlockers(
  preflight: ShotVideoTakePreflightReport
): ShotVideoTakeGenerationReadinessBlocker[] {
  const blockers: ShotVideoTakeGenerationReadinessBlocker[] = [];
  if (!preflight.inputModeId) {
    blockers.push({
      kind: 'missing-input-mode',
      message: 'The take does not have a selected video input mode.',
      recommendedSpecialist: 'media-producer',
      recommendedCommand: `renku take authoring context --take ${preflight.take.takeId} --json`,
    });
  }
  if (!preflight.modelChoice) {
    blockers.push({
      kind: 'missing-model',
      message: 'The take does not have a selected video model.',
      recommendedSpecialist: 'media-producer',
      recommendedCommand: `renku take authoring context --take ${preflight.take.takeId} --json`,
    });
  }
  return blockers;
}

function missingDependencyBlockers(
  preflight: ShotVideoTakePreflightReport
): ShotVideoTakeGenerationReadinessBlocker[] {
  return preflight.inputsToCreate
    .filter((dependency) => dependency.required)
    .map((dependency) => ({
      kind: readinessBlockerKindForInput(dependency.outputInputKind),
      message: `Required ${dependency.outputInputKind} input is missing for this take.`,
      recommendedSpecialist:
        dependency.mediaKind === 'audio' ? 'casting-director' : 'media-producer',
      ...(dependency.purpose
        ? {
            recommendedCommand: `renku generation context --purpose ${dependency.purpose} --target take:${preflight.take.takeId} --json`,
          }
        : {}),
    }));
}

function readinessBlockerKindForInput(
  kind: string
): ShotVideoTakeGenerationReadinessBlocker['kind'] {
  if (kind === 'first-frame') {
    return 'missing-first-frame';
  }
  if (kind === 'last-frame') {
    return 'missing-last-frame';
  }
  if (kind === 'reference-image') {
    return 'missing-reference-image';
  }
  if (kind === 'video-prompt-sheet') {
    return 'missing-video-prompt-sheet';
  }
  if (kind === 'audio') {
    return 'missing-dialogue-audio';
  }
  return 'missing-dependency-draft';
}

function missingFinalPromptBlockers(
  context: ShotVideoTakeProductionContext
): ShotVideoTakeGenerationReadinessBlocker[] {
  const finalPrompt =
    context.take.state.production.agentProposal?.finalPromptDraft?.prompt.trim();
  if (finalPrompt) {
    return [];
  }
  return [
    {
      kind: 'missing-final-prompt',
      message: 'The take does not have an authored final video prompt draft.',
      recommendedSpecialist: 'media-producer',
      recommendedCommand: `renku take authoring context --take ${context.take.takeId} --json`,
    },
  ];
}

function userDirectionQuestions(
  context: ShotVideoTakeProductionContext
): ShotVideoTakeGenerationReadiness['userDirectionNeeded'] {
  const questions: ShotVideoTakeGenerationReadiness['userDirectionNeeded'] = [];
  const hasMotionDirection = context.shots.some((shot) =>
    Boolean(shot.cameraMovement?.trim())
  );
  if (!hasMotionDirection) {
    questions.push({
      topic: 'camera-motion',
      question: 'What camera move should the take preserve from first frame to last frame?',
    });
  }
  if (context.selectedLocations.length === 0) {
    questions.push({
      topic: 'geography',
      question: 'Which location geography should anchor the video prompt and references?',
    });
  }
  return questions;
}

function optionalReadinessImprovements(
  context: ShotVideoTakeProductionContext
): ShotVideoTakeGenerationReadiness['optionalImprovements'] {
  const improvements: ShotVideoTakeGenerationReadiness['optionalImprovements'] = [];
  if (context.storyboardImages.length === 0) {
    improvements.push({
      kind: 'missing-scene-storyboard-images',
      message:
        'Scene storyboard images are optional context for this take but can improve visual continuity.',
    });
  }
  return improvements;
}

function directionEntries(
  document: SceneShotVideoTakeAuthoringDocument
): Array<{
  direction: SceneShotVideoTakeDirection;
  path: string[];
}> {
  if (document.structure.mode === 'continuous') {
    return [
      {
        direction: document.structure.sharedDirection,
        path: ['structure', 'sharedDirection'],
      },
    ];
  }
  return Object.entries(document.structure.directionsByShotId).map(
    ([shotId, direction]) => ({
      direction,
      path: ['structure', 'directionsByShotId', shotId],
    })
  );
}

function hasAsset(
  session: DatabaseSession,
  target: Parameters<typeof assetsForTarget>[1]['target'],
  role: string,
  assetId: string
): boolean {
  return assetsForTarget(session, { target, role }).some(
    (asset) => asset.assetId === assetId
  );
}

function throwAuthoringError(issues: DiagnosticIssue[]): void {
  const result = buildDiagnosticResult(issues);
  if (result.valid) {
    return;
  }
  throw new ProjectDataError(
    'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_DOCUMENT',
    'Scene Shot Video Take authoring document is invalid.',
    {
      issues: result.issues,
      suggestion: 'Repair the authoring document and validate it again.',
    }
  );
}

function issue(
  code: string,
  message: string,
  path: string[],
  suggestion: string
): DiagnosticIssue {
  return createDiagnosticError(code, message, { path }, suggestion);
}
