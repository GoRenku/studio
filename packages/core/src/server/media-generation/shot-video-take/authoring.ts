import {
  buildDiagnosticResult,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  SceneShot,
  SceneShotVideoTake,
  SceneShotVideoTakeAuthoringApplyReport,
  SceneShotVideoTakeAuthoringContextReport,
  SceneShotVideoTakeAuthoringDocument,
  SceneShotVideoTakeAuthoringValidationReport,
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeState,
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionContext,
  ShotVideoTakeProviderPayloadPreview,
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
  finalTakeSpecForPreflight,
  previewShotVideoTakeProduction,
} from './preflight-report.js';
import {
  planShotVideoTakeProductionForContext,
  readShotVideoTakeProductionPlan,
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
  prepareSceneShotVideoTakeInSession,
  sceneShotVideoTakeTarget,
} from './take-context.js';
import {
  sceneShotVideoTakeDirectionReferenceSelections,
  validateSceneShotVideoTakeStructure,
} from './take-state.js';

export async function readSceneShotVideoTakeAuthoringContext(
  input: ReadSceneShotVideoTakeAuthoringContextInput
): Promise<SceneShotVideoTakeAuthoringContextReport> {
  const context = await buildShotVideoTakeContext(input);
  const selectedShotId =
    context.take.state.structure.mode === 'multi-cut'
      ? input.selectedShotId
      : undefined;
  const productionInput = { ...input, selectedShotId };
  const productionPlan = await readShotVideoTakeProductionPlan({
    ...productionInput,
  });
  const preflight = await previewShotVideoTakeProduction(productionInput);
  return {
    kind: 'sceneShotVideoTakeAuthoringContext',
    document: authoringDocumentForTake(context.take),
    context,
    productionPlan,
    preflight,
    providerPreview: await previewProviderPayload({
      input: productionInput,
      context,
      preflight,
    }),
    resourceKeys: context.resourceKeys,
  };
}

export async function validateSceneShotVideoTakeAuthoringDocument(
  input: ValidateSceneShotVideoTakeAuthoringDocumentInput
): Promise<SceneShotVideoTakeAuthoringValidationReport> {
  const validated = await validateAuthoringDocument(input);
  return {
    valid: true,
    document: validated.document,
    context: await readSceneShotVideoTakeAuthoringContext({
      projectName: input.projectName,
      homeDir: input.homeDir,
      takeId: input.document.takeId,
      sceneId: input.document.sceneId,
    }),
    warnings: [],
  };
}

export async function applySceneShotVideoTakeAuthoringDocument(
  input: ApplySceneShotVideoTakeAuthoringDocumentInput
): Promise<SceneShotVideoTakeAuthoringApplyReport> {
  const validated = await validateAuthoringDocument(input);
  await withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input: {
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: validated.document.sceneId,
        takeId: validated.document.takeId,
      },
    });
    assertEditableSceneShotVideoTake(prepared.take);
    if (
      validated.document.baseTakeUpdatedAt &&
      prepared.take.updatedAt !== validated.document.baseTakeUpdatedAt
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
    applySceneShotVideoTakeAuthoringRecord(session, {
      takeId: validated.document.takeId,
      shotIds: validated.document.shotIds,
      state: {
        version: 2,
        structure: validated.document.structure,
        production: validated.document.production,
        ...(prepared.take.state.promptState
          ? { promptState: prepared.take.state.promptState }
          : {}),
      },
      screenplay,
      now: new Date().toISOString(),
    });
  });
  const context = await readSceneShotVideoTakeAuthoringContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: validated.document.takeId,
    sceneId: validated.document.sceneId,
  });
  return {
    valid: true,
    document: context.document,
    context,
    resourceKeys: context.resourceKeys,
  };
}

async function validateAuthoringDocument(
  input: ValidateSceneShotVideoTakeAuthoringDocumentInput
): Promise<{
  document: SceneShotVideoTakeAuthoringDocument;
  context: ShotVideoTakeProductionContext;
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
    validateShotIds({
      document,
      shots: prepared.shotList.shots,
      issues,
    });
    const state: SceneShotVideoTakeState = {
      version: 2,
      structure: document.structure,
      production: document.production,
      ...(prepared.take.state.promptState
        ? { promptState: prepared.take.state.promptState }
        : {}),
    };
    validateStructure({ state, shotIds: document.shotIds, issues });
    validateDirectionReferences({
      session,
      context: buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: proposedPreparedTake({
          prepared,
          document,
          state,
        }),
      }),
      document,
      issues,
    });
    throwAuthoringError(issues);
    const context = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared: proposedPreparedTake({
        prepared,
        document,
        state,
      }),
    });
    await validateProductionPlan({
      context,
      input,
      issues,
    });
    throwAuthoringError(issues);
    return { document, context, state };
  });
}

function proposedPreparedTake(input: {
  prepared: ReturnType<typeof prepareSceneShotVideoTakeInSession>;
  document: SceneShotVideoTakeAuthoringDocument;
  state: SceneShotVideoTakeState;
}): ReturnType<typeof prepareSceneShotVideoTakeInSession> {
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

function validateShotIds(input: {
  document: SceneShotVideoTakeAuthoringDocument;
  shots: SceneShot[];
  issues: DiagnosticIssue[];
}): void {
  if (input.document.shotIds.length === 0) {
    input.issues.push(
      issue(
        'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOTS_MISSING',
        'Authoring document must include at least one shot id.',
        ['shotIds'],
        'Use the ordered shot ids from the authoring context.'
      )
    );
    return;
  }
  const valid = new Set(input.shots.map((shot) => shot.shotId));
  const seen = new Set<string>();
  input.document.shotIds.forEach((shotId, index) => {
    if (!valid.has(shotId)) {
      input.issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOT_UNKNOWN',
          `Shot id is not in the source Scene Shot List: ${shotId}.`,
          ['shotIds', String(index)],
          'Use only shot ids from the source Scene Shot List.'
        )
      );
    }
    if (seen.has(shotId)) {
      input.issues.push(
        issue(
          'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOT_DUPLICATE',
          `Shot id is duplicated in the authoring document: ${shotId}.`,
          ['shotIds', String(index)],
          'List each grouped shot id once.'
        )
      );
    }
    seen.add(shotId);
  });
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
  input: ValidateSceneShotVideoTakeAuthoringDocumentInput;
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
