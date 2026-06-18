import type {
  SceneShotVideoTake,
  ShotVideoTakeGenerationContext,
} from '../../../client/index.js';
import {
  insertSceneShotVideoTakeRecord,
  listSceneShotVideoTakesForScene,
  requireSceneShotVideoTake,
  updateSceneShotVideoTakeProductionRecord,
  updateSceneShotVideoTakeStateRecord,
  updateSceneShotVideoTakeShotSpecsRecord,
  updateSceneShotVideoTakeShotMembershipRecord,
} from '../../database/access/scene-shot-video-take-generations.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../entity-ids.js';
import type {
  CreateSceneShotVideoTakeInput,
  ListSceneShotVideoTakesInput,
  ReadSceneShotVideoTakeInput,
  UpdateSceneShotVideoTakeProductionInput,
  UpdateSceneShotVideoTakeStateInput,
  UpdateSceneShotVideoTakeShotSpecsInput,
  UpdateSceneShotVideoTakeShotsInput,
} from '../../project-data-service-contracts.js';
import {
  buildContextFromPrepared,
} from './context.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  assertEditableSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
} from './take-generation-context.js';

export async function createSceneShotVideoTake(
  input: CreateSceneShotVideoTakeInput
): Promise<SceneShotVideoTake> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    return insertSceneShotVideoTakeRecord(session, {
      id: ids('scene_shot_video_take'),
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      title: input.title,
      shotIds: input.shotIds,
      screenplay,
      now: new Date().toISOString(),
    });
  });
}

export async function readSceneShotVideoTake(
  input: ReadSceneShotVideoTakeInput
): Promise<SceneShotVideoTake> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    return requireSceneShotVideoTake(session, {
      takeId: input.takeId,
      screenplay,
    });
  });
}

export async function listSceneShotVideoTakes(
  input: ListSceneShotVideoTakesInput
): Promise<{ takes: SceneShotVideoTake[] }> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    return {
      takes: listSceneShotVideoTakesForScene(session, {
        sceneId: input.sceneId,
        screenplay,
      }),
    };
  });
}

export async function updateSceneShotVideoTakeProduction(
  input: UpdateSceneShotVideoTakeProductionInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const current = requireSceneShotVideoTake(session, {
      takeId: input.takeId,
      screenplay,
    });
    assertEditableSceneShotVideoTake(current);
    updateSceneShotVideoTakeProductionRecord(session, {
      takeId: input.takeId,
      production: input.production,
      screenplay,
      now: new Date().toISOString(),
    });
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}

export async function updateSceneShotVideoTakeShotSpecs(
  input: UpdateSceneShotVideoTakeShotSpecsInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const current = requireSceneShotVideoTake(session, {
      takeId: input.takeId,
      screenplay,
    });
    assertEditableSceneShotVideoTake(current);
    updateSceneShotVideoTakeShotSpecsRecord(session, {
      takeId: input.takeId,
      shotId: input.shotId,
      shotSpecs: input.shotSpecs,
      screenplay,
      now: new Date().toISOString(),
    });
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}

export async function updateSceneShotVideoTakeState(
  input: UpdateSceneShotVideoTakeStateInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const current = requireSceneShotVideoTake(session, {
      takeId: input.takeId,
      screenplay,
    });
    assertEditableSceneShotVideoTake(current);
    updateSceneShotVideoTakeStateRecord(session, {
      takeId: input.takeId,
      state: mergeSceneShotVideoTakeStatePatch({
        current: current.state,
        patch: input.statePatch,
      }),
      screenplay,
      now: new Date().toISOString(),
    });
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}

export async function updateSceneShotVideoTakeShots(
  input: UpdateSceneShotVideoTakeShotsInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const current = requireSceneShotVideoTake(session, {
      takeId: input.takeId,
      screenplay,
    });
    assertEditableSceneShotVideoTake(current);
    updateSceneShotVideoTakeShotMembershipRecord(session, {
      takeId: input.takeId,
      shotIds: input.shotIds,
      screenplay,
      now: new Date().toISOString(),
    });
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}

function mergeSceneShotVideoTakeStatePatch(input: {
  current: SceneShotVideoTake['state'];
  patch: UpdateSceneShotVideoTakeStateInput['statePatch'];
}): SceneShotVideoTake['state'] {
  return {
    ...input.current,
    ...input.patch,
    version: 1,
    shotDesignByShotId: {
      ...input.current.shotDesignByShotId,
      ...input.patch.shotDesignByShotId,
    },
    referenceSelections: {
      ...input.current.referenceSelections,
      ...input.patch.referenceSelections,
      dependencyInclusions: {
        ...input.current.referenceSelections.dependencyInclusions,
        ...input.patch.referenceSelections?.dependencyInclusions,
      },
      selectedCharacterSheetAssetIds: {
        ...input.current.referenceSelections.selectedCharacterSheetAssetIds,
        ...input.patch.referenceSelections?.selectedCharacterSheetAssetIds,
      },
      selectedLocationSheetAssetIds: {
        ...input.current.referenceSelections.selectedLocationSheetAssetIds,
        ...input.patch.referenceSelections?.selectedLocationSheetAssetIds,
      },
      selectedLocationViewIds: {
        ...input.current.referenceSelections.selectedLocationViewIds,
        ...input.patch.referenceSelections?.selectedLocationViewIds,
      },
      selectedLookbookSheetIds:
        input.patch.referenceSelections?.selectedLookbookSheetIds ??
        input.current.referenceSelections.selectedLookbookSheetIds,
      selectedDialogueAudioTakeIds: {
        ...input.current.referenceSelections.selectedDialogueAudioTakeIds,
        ...input.patch.referenceSelections?.selectedDialogueAudioTakeIds,
      },
    },
    production: {
      ...input.current.production,
      ...input.patch.production,
    },
  };
}
