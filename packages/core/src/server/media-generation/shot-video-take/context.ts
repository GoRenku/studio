import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  ShotVideoTakeGenerationContext,
} from '../../../client/index.js';
import {
  readActiveLookbookId,
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
  PreparedShotGroup,
  prepareShotGroupInSession,
  requireShot,
} from './shot-group.js';



export async function buildShotVideoTakeContext(
  input: ShotVideoTakeContextInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({
      session,
      input,
      now,
      persist: false,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}



export function buildContextFromPrepared(input: {
  session: DatabaseSession;
  projectFolder: string;
  project: Pick<ProjectRecord, 'id' | 'name'>;
  prepared: PreparedShotGroup;
}): ShotVideoTakeGenerationContext {
  const screenplay = requireScreenplayDocument(input.session);
  const hierarchy = requireSceneHierarchy(screenplay, input.prepared.sceneId);
  const projectInfo = readProjectInformationResourceFromDatabase(input.session);
  const shots = input.prepared.orderedShotIds.map((shotId) =>
    requireShot(input.prepared.shotList.shots, shotId)
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
  const activeLookbook = readActiveLookbookId(input.session);
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
      id: input.prepared.shotListId,
      title: input.prepared.shotList.title,
      summary: input.prepared.shotList.summary,
      createdAt: input.prepared.shotListRow.createdAt,
      updatedAt: input.prepared.shotListRow.updatedAt,
      isActive: activeShotListId === input.prepared.shotListId,
    },
    productionGroup: input.prepared.productionGroup,
    shots,
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
          return { id: lookbook.id, name: lookbook.name, thesis: lookbook.thesis.statement };
        })()
      : null,
    storyboardImages: [],
    availableInputs: listShotVideoTakeInputRecords(input.session, {
      sceneId: input.prepared.sceneId,
      shotListId: input.prepared.shotListId,
      productionGroupId: input.prepared.productionGroup.productionGroupId,
      shotIds: input.prepared.orderedShotIds,
    }),
    existingTakes: listShotVideoTakes(input.session, {
      sceneId: input.prepared.sceneId,
      shotListId: input.prepared.shotListId,
      productionGroupId: input.prepared.productionGroup.productionGroupId,
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
