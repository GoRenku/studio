import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  SceneShotVideoTakeEditContext,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import {
  readSelectedMovieLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../../database/access/lookbook.js';
import {
  readProjectInformationResourceFromDatabase,
} from '../../database/access/project-information.js';
import type {
  ProjectRecord,
} from '../../database/access/project.js';
import {
  readActiveSceneShotListId,
} from '../../database/access/scene-shot-lists.js';
import {
  listShotVideoTakeInputs as listShotVideoTakeInputRecords,
  listShotVideoTakes,
} from '../../database/access/shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import type {
  ShotVideoTakeContextInput,
} from '../../project-data-service-contracts.js';
import {
  requireSceneHierarchy,
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  orderedScreenplayItems,
  sceneNarrativeReferenceScope,
  sceneShotReferenceScope,
} from './reference-scope.js';
import {
  selectedLocationIdsForShots,
  selectedNarrativeCastIdsForShots,
} from './reference-selection.js';
import {
  shotVideoTakeResourceKeys,
} from './resource-keys.js';
import {
  PreparedSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
  requireShot,
} from './take-context.js';
import {
  applyTakeStateToShot,
} from './take-state.js';



export async function buildShotVideoTakeContext(
  input: ShotVideoTakeContextInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
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



export async function readSceneShotVideoTakeEditContext(
  input: ShotVideoTakeContextInput
): Promise<SceneShotVideoTakeEditContext> {
  return shotVideoTakeEditContextFromProductionContext(
    await buildShotVideoTakeContext(input)
  );
}



export function buildContextFromPrepared(input: {
  session: DatabaseSession;
  projectFolder: string;
  project: Pick<ProjectRecord, 'id' | 'name'>;
  prepared: PreparedSceneShotVideoTake;
}): ShotVideoTakeProductionContext {
  const screenplay = requireScreenplayDocument(input.session);
  const hierarchy = requireSceneHierarchy(screenplay, input.prepared.sceneId);
  const projectInfo = readProjectInformationResourceFromDatabase(input.session);
  const shots = input.prepared.orderedShotIds.map((shotId) =>
    applyTakeStateToShot({
      shot: requireShot(input.prepared.shotList.shots, shotId),
      state: input.prepared.take.state,
    })
  );
  const narrativeScope = sceneNarrativeReferenceScope({
    session: input.session,
    screenplay,
    sceneId: input.prepared.sceneId,
  });
  const scope = sceneShotReferenceScope({
    screenplay,
    narrativeScope,
    shotList: input.prepared.shotList,
  });
  const selectedLocationIds = selectedLocationIdsForShots(shots);
  const selectedCastMemberIds = selectedNarrativeCastIdsForShots({
    shots,
    narrativeScope,
  });
  const activeLookbook = readSelectedMovieLookbookId(input.session);
  const activeShotListId = readActiveSceneShotListId(input.session, input.prepared.sceneId);
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: input.prepared.target,
    project: {
      id: input.project.id,
      name: input.project.name,
      title: projectInfo.title,
      aspectRatio: projectInfo.aspectRatio ?? '16:9',
    },
    scene: {
      id: hierarchy.scene.id as string,
      title: hierarchy.scene.title,
      setting: hierarchy.scene.setting,
      storyFunction: hierarchy.scene.storyFunction ?? [],
    },
    shotList: {
      id: input.prepared.sourceShotListId,
      title: input.prepared.shotList.title,
      summary: input.prepared.shotList.summary,
      createdAt: input.prepared.shotListRow.createdAt,
      updatedAt: input.prepared.shotListRow.updatedAt,
      isActive: activeShotListId === input.prepared.sourceShotListId,
    },
    take: input.prepared.take,
    shots,
    displayShots: input.prepared.shotList.shots.map((shot) =>
      applyTakeStateToShot({
        shot,
        state: input.prepared.take.state,
      })
    ),
    referencedCast: orderedScreenplayItems(screenplay.cast, selectedCastMemberIds)
      .map((castMember) => ({
        id: castMember.id as string,
        handle: castMember.handle,
        name: castMember.name,
        role: castMember.role,
        isVoiceOver: castMember.isVoiceOver,
        description: castMember.description,
      })),
    referencedLocations: scope.locations
      .filter((location) => location.id && selectedLocationIds.has(location.id))
      .map((location) => ({
        id: location.id as string,
        handle: location.handle,
        name: location.name,
        description: location.description,
      })),
    activeLookbook: activeLookbook
      ? (() => {
          const row = requireLookbookRecordById(input.session, activeLookbook);
          const lookbook = toLookbook(row);
          if (lookbook.type !== 'movie') {
            return null;
          }
          return {
            id: lookbook.id,
            name: lookbook.name,
            thesis: lookbook.definition.thesis.statement,
          };
        })()
      : null,
    storyboardImages: [],
    mediaInputs: listShotVideoTakeInputRecords(input.session, {
      sceneId: input.prepared.sceneId,
      takeId: input.prepared.take.takeId,
      shotIds: input.prepared.orderedShotIds,
    }),
    outputs: listShotVideoTakes(input.session, {
      sceneId: input.prepared.sceneId,
      takeId: input.prepared.take.takeId,
    }),
    shotGroupMode:
      input.prepared.orderedShotIds.length > 1 ? 'multi-shot' : 'single-shot',
    defaults: {
      inputModeId: 'first-frame',
      imageDependencyModelChoice: 'fal-ai/openai/gpt-image-2',
      parameterValues: {
        aspect_ratio: projectInfo.aspectRatio ?? '16:9',
      },
    },
    resourceKeys: shotVideoTakeResourceKeys(input.prepared),
  };
}



function shotVideoTakeEditContextFromProductionContext(
  context: ShotVideoTakeProductionContext
): SceneShotVideoTakeEditContext {
  const selectedInputs = context.mediaInputs.filter((input) => input.selected);
  const readyInputs = selectedInputs.filter(
    (input) => input.assetId && input.assetFileId && input.projectRelativePath
  );
  return {
    purpose: context.purpose,
    target: context.target,
    project: context.project,
    scene: context.scene,
    take: context.take,
    sourceShotList: context.shotList,
    sourceShots: context.shots,
    displayShots: context.displayShots,
    shotGroupMode: context.shotGroupMode,
    referencedCast: context.referencedCast,
    referencedLocations: context.referencedLocations,
    activeLookbook: context.activeLookbook,
    storyboardImages: context.storyboardImages,
    mediaInputs: context.mediaInputs,
    outputs: context.outputs,
    assetReadiness: {
      selectedInputCount: selectedInputs.length,
      readyInputCount: readyInputs.length,
      missingInputCount: selectedInputs.length - readyInputs.length,
      diagnostics: [],
    },
    defaults: context.defaults,
    resourceKeys: context.resourceKeys,
  };
}
