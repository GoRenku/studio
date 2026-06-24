import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  SceneShotVideoTakeReferenceSelections,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import {
  readLookbookSheetRecord,
} from '../../database/access/lookbook-sheets.js';
import {
  readSceneDialogueAudioRecord,
  readSceneDialogueAudioTakeRecord,
} from '../../database/access/scene-dialogue-audio.js';
import {
  updateSceneShotVideoTakeStateRecord,
} from '../../database/access/scene-shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  UpdateSceneShotVideoTakeCharacterSheetSelectionInput,
  UpdateSceneShotVideoTakeDialogueAudioSelectionInput,
  UpdateSceneShotVideoTakeLocationSheetSelectionInput,
  UpdateSceneShotVideoTakeLookbookSheetSelectionInput,
  UpdateSceneShotVideoTakeReferenceInclusionInput,
} from '../../project-data-service-contracts.js';
import {
  assetsForTarget,
} from './reference-card-plans.js';
import {
  buildContextFromPrepared,
} from './context.js';
import {
  planShotVideoTakeProduction,
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
} from './take-context.js';

export async function updateSceneShotVideoTakeCharacterSheetSelection(
  input: UpdateSceneShotVideoTakeCharacterSheetSelectionInput
): Promise<ShotVideoTakeProductionContext> {
  return updateSceneShotVideoTakeReferenceSelections(input, ({ session, context }) => {
    assertSceneCastMember(session, context, input.castMemberId);
    if (input.assetId !== null) {
      assertCastCharacterSheetAsset(session, input.castMemberId, input.assetId);
    }
    return {
      ...context.take.state.referenceSelections,
      selectedCharacterSheetAssetIds: withRecordSelection(
        context.take.state.referenceSelections.selectedCharacterSheetAssetIds,
        input.castMemberId,
        input.assetId
      ),
    };
  });
}

export async function updateSceneShotVideoTakeLocationSheetSelection(
  input: UpdateSceneShotVideoTakeLocationSheetSelectionInput
): Promise<ShotVideoTakeProductionContext> {
  return updateSceneShotVideoTakeReferenceSelections(input, ({ session, context }) => {
    assertSceneLocation(session, context, input.locationId);
    const assetIds = uniqueStringList(input.assetIds);
    for (const assetId of assetIds) {
      assertLocationEnvironmentSheetAsset(session, input.locationId, assetId);
    }
    return {
      ...context.take.state.referenceSelections,
      referencedLocationSheetAssetIds: withArrayRecordSelection(
        context.take.state.referenceSelections.referencedLocationSheetAssetIds,
        input.locationId,
        assetIds
      ),
    };
  });
}

export async function updateSceneShotVideoTakeLookbookSheetSelection(
  input: UpdateSceneShotVideoTakeLookbookSheetSelectionInput
): Promise<ShotVideoTakeProductionContext> {
  return updateSceneShotVideoTakeReferenceSelections(input, ({ session, context }) => {
    if (input.lookbookSheetId !== null) {
      assertActiveLookbookSheet(session, context, input.lookbookSheetId);
    }
    return {
      ...context.take.state.referenceSelections,
      selectedLookbookSheetIds: input.lookbookSheetId ? [input.lookbookSheetId] : [],
    };
  });
}

export async function updateSceneShotVideoTakeDialogueAudioSelection(
  input: UpdateSceneShotVideoTakeDialogueAudioSelectionInput
): Promise<ShotVideoTakeProductionContext> {
  return updateSceneShotVideoTakeReferenceSelections(input, ({ session, context }) => {
    assertSceneDialogue(session, context, input.dialogueId);
    if (input.dialogueAudioTakeId !== null) {
      assertSceneDialogueAudioTake(
        session,
        context,
        input.dialogueId,
        input.dialogueAudioTakeId
      );
    }
    return {
      ...context.take.state.referenceSelections,
      selectedDialogueAudioTakeIds: withRecordSelection(
        context.take.state.referenceSelections.selectedDialogueAudioTakeIds,
        input.dialogueId,
        input.dialogueAudioTakeId
      ),
    };
  });
}

export async function updateSceneShotVideoTakeReferenceInclusion(
  input: UpdateSceneShotVideoTakeReferenceInclusionInput
): Promise<ShotVideoTakeProductionContext> {
  const plan = await planShotVideoTakeProduction(input);
  return updateSceneShotVideoTakeReferenceSelections(input, ({ context }) => {
    assertKnownDependencyInclusion({
      context,
      dependencyId: input.dependencyId,
      inclusion: input.inclusion,
      dependencyLines: plan.dependencyInventory.dependencies,
    });
    return {
      ...context.take.state.referenceSelections,
      dependencyInclusions: withRecordSelection(
        context.take.state.referenceSelections.dependencyInclusions,
        input.dependencyId,
        input.inclusion
      ),
    };
  });
}

async function updateSceneShotVideoTakeReferenceSelections(
  input:
    | UpdateSceneShotVideoTakeCharacterSheetSelectionInput
    | UpdateSceneShotVideoTakeLocationSheetSelectionInput
    | UpdateSceneShotVideoTakeLookbookSheetSelectionInput
    | UpdateSceneShotVideoTakeDialogueAudioSelectionInput
    | UpdateSceneShotVideoTakeReferenceInclusionInput,
  buildReferenceSelections: (input: {
    session: DatabaseSession;
    context: ShotVideoTakeProductionContext;
  }) => SceneShotVideoTakeReferenceSelections
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const prepared = prepareSceneShotVideoTakeInSession({ session, input });
    assertEditableSceneShotVideoTake(prepared.take);
    const context = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
    const referenceSelections = buildReferenceSelections({ session, context });
    updateSceneShotVideoTakeStateRecord(session, {
      takeId: prepared.take.takeId,
      state: {
        ...prepared.take.state,
        referenceSelections,
      },
      screenplay,
      now: new Date().toISOString(),
    });
    const refreshed = prepareSceneShotVideoTakeInSession({ session, input });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared: refreshed,
    });
  });
}

function assertSceneCastMember(
  session: DatabaseSession,
  context: ShotVideoTakeProductionContext,
  castMemberId: string
): void {
  const screenplay = requireScreenplayDocument(session);
  const scope = sceneNarrativeReferenceScope({
    session,
    screenplay,
    sceneId: context.scene.id,
  });
  if (scope.castMembers.some((castMember) => castMember.id === castMemberId)) {
    return;
  }
  throwReferenceSelectionError({
    code: 'PROJECT_DATA424',
    message: 'Cast Member is not in this scene reference scope.',
    path: ['castMemberId'],
    suggestion:
      'Refresh the scene references and select a character sheet for a Cast Member in this scene.',
  });
}

function assertCastCharacterSheetAsset(
  session: DatabaseSession,
  castMemberId: string,
  assetId: string
): void {
  const assets = assetsForTarget(session, {
    target: { kind: 'castMember', castMemberId },
    role: 'character_sheet',
  });
  if (assets.some((asset) => asset.assetId === assetId)) {
    return;
  }
  throwReferenceSelectionError({
    code: 'PROJECT_DATA425',
    message: 'Character sheet asset does not belong to the requested Cast Member.',
    path: ['assetId'],
    suggestion:
      'Refresh the character sheet choices and select an asset attached to this Cast Member.',
  });
}

function assertSceneLocation(
  session: DatabaseSession,
  context: ShotVideoTakeProductionContext,
  locationId: string
): void {
  const screenplay = requireScreenplayDocument(session);
  const narrativeScope = sceneNarrativeReferenceScope({
    session,
    screenplay,
    sceneId: context.scene.id,
  });
  if (narrativeScope.locations.some((location) => location.id === locationId)) {
    return;
  }
  throwReferenceSelectionError({
    code: 'PROJECT_DATA426',
    message: 'Location is not in this scene shot reference scope.',
    path: ['locationId'],
    suggestion:
      'Refresh the location references and select a sheet for a Location in this take.',
  });
}

function assertLocationEnvironmentSheetAsset(
  session: DatabaseSession,
  locationId: string,
  assetId: string
): void {
  const assets = assetsForTarget(session, {
    target: { kind: 'location', locationId },
    role: 'environment_sheet',
  });
  if (assets.some((asset) => asset.assetId === assetId)) {
    return;
  }
  throwReferenceSelectionError({
    code: 'PROJECT_DATA427',
    message: 'Location sheet asset does not belong to the requested Location.',
    path: ['assetId'],
    suggestion:
      'Refresh the location sheet choices and select an environment sheet attached to this Location.',
  });
}

function assertActiveLookbookSheet(
  session: DatabaseSession,
  context: ShotVideoTakeProductionContext,
  lookbookSheetId: string
): void {
  const sheet = readLookbookSheetRecord(session, lookbookSheetId);
  if (sheet && context.activeLookbook?.id === sheet.lookbookId) {
    return;
  }
  throwReferenceSelectionError({
    code: 'PROJECT_DATA429',
    message: 'Lookbook sheet does not belong to the active Lookbook for this take.',
    path: ['lookbookSheetId'],
    suggestion:
      'Refresh the Lookbook references and select a sheet from the active Lookbook.',
  });
}

function assertSceneDialogue(
  session: DatabaseSession,
  context: ShotVideoTakeProductionContext,
  dialogueId: string
): void {
  const screenplay = requireScreenplayDocument(session);
  const scene = screenplay.acts
    .flatMap((act) => act.sequences)
    .flatMap((sequence) => sequence.scenes)
    .find((candidate) => candidate.id === context.scene.id);
  const belongsToScene = scene?.blocks.some(
    (block) => block.type === 'dialogue' && block.dialogueId === dialogueId
  );
  if (belongsToScene) {
    return;
  }
  throwReferenceSelectionError({
    code: 'PROJECT_DATA430',
    message: 'Dialogue block does not belong to this scene.',
    path: ['dialogueId'],
    suggestion:
      'Refresh the dialogue audio references and select a dialogue from this scene.',
  });
}

function assertSceneDialogueAudioTake(
  session: DatabaseSession,
  context: ShotVideoTakeProductionContext,
  dialogueId: string,
  takeId: string
): void {
  const audio = readSceneDialogueAudioRecord(session, {
    sceneId: context.scene.id,
    dialogueId,
  });
  const take = audio
    ? readSceneDialogueAudioTakeRecord(session, {
        sceneDialogueAudioId: audio.id,
        takeId,
      })
    : null;
  if (take) {
    return;
  }
  throwReferenceSelectionError({
    code: 'PROJECT_DATA431',
    message: 'Dialogue audio take does not belong to the requested dialogue.',
    path: ['takeId'],
    suggestion:
      'Refresh the dialogue audio takes and select a take generated for this dialogue.',
  });
}

function assertKnownDependencyInclusion(input: {
  context: ShotVideoTakeProductionContext;
  dependencyId: string;
  inclusion: 'include' | 'exclude' | null;
  dependencyLines: Array<{ dependencyId: string; required: boolean }>;
}): void {
  const line = input.dependencyLines.find(
    (candidate) => candidate.dependencyId === input.dependencyId
  );
  const alreadyStored =
    input.context.take.state.referenceSelections.dependencyInclusions[
      input.dependencyId
    ] !== undefined;
  if (!line && !alreadyStored) {
    throwReferenceSelectionError({
      code: 'PROJECT_DATA432',
      message: 'Reference inclusion dependency id is not known for this take.',
      path: ['dependencyId'],
      suggestion:
        'Refresh the take reference inventory and retry with a listed dependency id.',
    });
  }
  if (line?.required && input.inclusion === 'exclude') {
    throwReferenceSelectionError({
      code: 'PROJECT_DATA433',
      message: 'Required reference dependency cannot be excluded.',
      path: ['inclusion'],
      suggestion:
        'Clear the override or choose a generation route where this reference is optional.',
    });
  }
}

function withRecordSelection<T extends string>(
  record: Record<string, T>,
  key: string,
  value: T | null
): Record<string, T> {
  if (value === null) {
    return withoutRecordKey(record, key);
  }
  return { ...record, [key]: value };
}

function withoutRecordKey<T>(
  record: Record<string, T>,
  key: string
): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function withArrayRecordSelection(
  record: Record<string, string[]>,
  key: string,
  value: string[]
): Record<string, string[]> {
  if (value.length === 0) {
    return withoutRecordKey(record, key);
  }
  return { ...record, [key]: value };
}

function uniqueStringList(values: string[]): string[] {
  if (values.some((value) => value.trim().length === 0)) {
    throwReferenceSelectionError({
      code: 'PROJECT_DATA427',
      message: 'Location Sheet asset id cannot be blank.',
      path: ['assetIds'],
      suggestion: 'Choose an existing Location Sheet asset for this Location.',
    });
  }
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique;
}

function throwReferenceSelectionError(input: {
  code: string;
  message: string;
  path: string[];
  suggestion: string;
}): never {
  throw new ProjectDataError(input.code, input.message, {
    issues: [
      createDiagnosticError(
        input.code,
        input.message,
        { path: input.path },
        input.suggestion
      ),
    ],
    suggestion: input.suggestion,
  });
}
