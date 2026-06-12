import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeProductionGroup,
  ShotVideoTakeRailGroup,
  SceneShot,
  ShotVideoTakeProductionPlan,
} from '../../../client/index.js';
import {
  requireSceneShotListForScene,
  readSceneShotListDocument,
  updateSceneShotListRecordDocument,
} from '../../database/access/scene-shot-lists.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../entity-ids.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  UpdateShotVideoTakeProductionGroupInput,
  UpdateShotVideoTakeRailGroupsInput,
  UpdateShotVideoTakeRailGroupsReport,
} from '../../project-data-service-contracts.js';
import {
  buildContextFromPrepared,
} from './context.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  normalizeShotIds,
  prepareShotGroupInSession,
  sameShotIds,
} from './shot-group.js';



export async function updateShotVideoTakeProductionGroup(
  input: UpdateShotVideoTakeProductionGroupInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({
      session,
      input,
      now,
      production: input.production,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}



export async function updateShotVideoTakeRailGroups(
  input: UpdateShotVideoTakeRailGroupsInput
): Promise<UpdateShotVideoTakeRailGroupsReport> {
  return withShotProjectSession(input, ({ session }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const shotListRow = requireSceneShotListForScene({
      session,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
    });
    const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    const normalizedRailInputs = normalizeRailGroupInputs({
      shots: shotList.shots,
      railGroups: input.railGroups,
    });
    const productionGroups = (shotList.videoTakeProductionGroups ?? []).filter(
      (group) => group.shotIds.length > 0
    );
    const productionGroupsById = new Map(
      productionGroups.map((group) => [group.productionGroupId, group])
    );
    const nextProductionGroupsById = new Map<
      string,
      ShotVideoTakeProductionGroup
    >();
    const nextRailGroups: ShotVideoTakeRailGroup[] = [];
    const requestedRailShotIds = new Set<string>();

    normalizedRailInputs.forEach((railGroup) => {
      railGroup.shotIds.forEach((shotId) => requestedRailShotIds.add(shotId));
      const existingGroup = railGroup.productionGroupId
        ? productionGroupsById.get(railGroup.productionGroupId)
        : undefined;
      if (railGroup.productionGroupId && !existingGroup) {
        throw new ProjectDataError(
          'PROJECT_DATA413',
          `Shot video take rail group references an unknown production group: ${railGroup.productionGroupId}.`
        );
      }
      const sourceGroup = resolveRailGroupSource({
        railGroup,
        existingGroup,
        productionGroupsById,
      });
      const productionGroupId =
        existingGroup?.productionGroupId ?? ids('scene_shot_video_take_group');
      const videoTakeProduction = sourceGroup
        ? carryProductionPlanForShotMembership({
            plan: sourceGroup.videoTakeProduction,
            previousShotIds: sourceGroup.shotIds,
            nextShotIds: railGroup.shotIds,
          })
        : {};
      const productionGroup = {
        productionGroupId,
        shotIds: railGroup.shotIds,
        videoTakeProduction,
      };
      nextProductionGroupsById.set(productionGroupId, productionGroup);
      nextRailGroups.push({
        productionGroupId,
        shotIds: railGroup.shotIds,
      });
    });

    addSingleShotProductionGroupsForClearedRailShots({
      oldRailGroups: shotList.videoTakeRailGroups ?? [],
      productionGroupsById,
      requestedRailShotIds,
      nextProductionGroupsById,
      allocateProductionGroupId: () => ids('scene_shot_video_take_group'),
    });
    keepUnchangedSingleShotProductionGroups({
      productionGroups,
      requestedRailShotIds,
      nextProductionGroupsById,
    });

    const updatedShotList = {
      ...shotList,
      videoTakeRailGroups: nextRailGroups,
      videoTakeProductionGroups: orderProductionGroupsForShotList(
        shotList.shots,
        [...nextProductionGroupsById.values()]
      ),
    };
    updateSceneShotListRecordDocument({
      session,
      id: input.shotListId,
      document: updatedShotList,
      screenplay,
      now,
    });
    return {
      railGroups: nextRailGroups,
      resourceKeys: [
        `scene:${input.sceneId}`,
        `surface:scene:${input.sceneId}:shots`,
        `scene-shot-list:${input.shotListId}:video-take-rail-groups`,
        `scene-shot-list:${input.shotListId}:video-take-production`,
      ],
    };
  });
}



export type NormalizedShotVideoTakeRailGroupInput =
  UpdateShotVideoTakeRailGroupsInput['railGroups'][number] & {
    shotIds: string[];
  };



export function normalizeRailGroupInputs(input: {
  shots: SceneShot[];
  railGroups: UpdateShotVideoTakeRailGroupsInput['railGroups'];
}): NormalizedShotVideoTakeRailGroupInput[] {
  const assignedShotIds = new Map<string, number>();
  return input.railGroups.map((railGroup, railGroupIndex) => {
    const shotIds = normalizeShotIds(input.shots, railGroup.shotIds);
    shotIds.forEach((shotId) => {
      const existingRailGroupIndex = assignedShotIds.get(shotId);
      if (existingRailGroupIndex !== undefined) {
        throw new ProjectDataError(
          'PROJECT_DATA414',
          `Shot belongs to more than one video take rail group: ${shotId}.`,
          {
            suggestion: `Remove the shot from rail group ${existingRailGroupIndex + 1} or ${railGroupIndex + 1}.`,
          }
        );
      }
      assignedShotIds.set(shotId, railGroupIndex);
    });
    return {
      ...railGroup,
      shotIds,
    };
  });
}



export function resolveRailGroupSource(input: {
  railGroup: NormalizedShotVideoTakeRailGroupInput;
  existingGroup?: ShotVideoTakeProductionGroup;
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
}): ShotVideoTakeProductionGroup | undefined {
  if (input.railGroup.mergePartnerProductionGroupId) {
    requireProductionGroupId(
      input.productionGroupsById,
      input.railGroup.mergePartnerProductionGroupId,
      'merge partner'
    );
  }
  if (input.existingGroup) {
    return input.existingGroup;
  }
  if (input.railGroup.sourceProductionGroupId) {
    return requireProductionGroupId(
      input.productionGroupsById,
      input.railGroup.sourceProductionGroupId,
      'source'
    );
  }
  return undefined;
}



export function requireProductionGroupId(
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>,
  productionGroupId: string,
  role: 'source' | 'merge partner'
): ShotVideoTakeProductionGroup {
  const productionGroup = productionGroupsById.get(productionGroupId);
  if (!productionGroup) {
    throw new ProjectDataError(
      'PROJECT_DATA415',
      `Shot video take rail group references an unknown ${role} production group: ${productionGroupId}.`
    );
  }
  return productionGroup;
}



export function addSingleShotProductionGroupsForClearedRailShots(input: {
  oldRailGroups: ShotVideoTakeRailGroup[];
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
  requestedRailShotIds: Set<string>;
  nextProductionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
  allocateProductionGroupId: () => string;
}): void {
  input.oldRailGroups.forEach((oldRailGroup) => {
    const sourceGroup = input.productionGroupsById.get(
      oldRailGroup.productionGroupId
    );
    if (!sourceGroup) {
      throw new ProjectDataError(
        'PROJECT_DATA416',
        `Stored rail group references an unknown production group: ${oldRailGroup.productionGroupId}.`
      );
    }
    oldRailGroup.shotIds.forEach((shotId) => {
      if (input.requestedRailShotIds.has(shotId)) {
        return;
      }
      const existingSingleShotGroup = findSingleShotProductionGroup(
        input.productionGroupsById,
        shotId
      );
      const productionGroupId =
        existingSingleShotGroup?.productionGroupId ??
        (oldRailGroup.shotIds.length === 1
          ? oldRailGroup.productionGroupId
          : input.allocateProductionGroupId());
      input.nextProductionGroupsById.set(productionGroupId, {
        productionGroupId,
        shotIds: [shotId],
        videoTakeProduction: carryProductionPlanForShotMembership({
          plan:
            existingSingleShotGroup?.videoTakeProduction ??
            sourceGroup.videoTakeProduction,
          previousShotIds:
            existingSingleShotGroup?.shotIds ?? sourceGroup.shotIds,
          nextShotIds: [shotId],
        }),
      });
    });
  });
}



export function keepUnchangedSingleShotProductionGroups(input: {
  productionGroups: ShotVideoTakeProductionGroup[];
  requestedRailShotIds: Set<string>;
  nextProductionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
}): void {
  input.productionGroups.forEach((productionGroup) => {
    if (productionGroup.shotIds.length !== 1) {
      return;
    }
    const shotId = productionGroup.shotIds[0];
    if (
      !shotId ||
      input.requestedRailShotIds.has(shotId) ||
      input.nextProductionGroupsById.has(productionGroup.productionGroupId)
    ) {
      return;
    }
    input.nextProductionGroupsById.set(
      productionGroup.productionGroupId,
      productionGroup
    );
  });
}



export function findSingleShotProductionGroup(
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>,
  shotId: string
): ShotVideoTakeProductionGroup | undefined {
  return [...productionGroupsById.values()].find((group) =>
    sameShotIds(group.shotIds, [shotId])
  );
}



export function carryProductionPlanForShotMembership(input: {
  plan: ShotVideoTakeProductionPlan;
  previousShotIds: string[];
  nextShotIds: string[];
}): ShotVideoTakeProductionPlan {
  const membershipChanged = !sameShotIds(
    input.previousShotIds,
    input.nextShotIds
  );
  const requestedInputs = input.plan.requestedInputs
    ?.filter(
      (requestedInput) =>
        requestedInput.subjectKind !== 'shot' ||
        !requestedInput.subjectId ||
        input.nextShotIds.includes(requestedInput.subjectId)
    )
    .map((requestedInput) => ({ ...requestedInput }));
  const agentProposal = input.plan.agentProposal
    ? {
        ...input.plan.agentProposal,
        ...(membershipChanged
          ? {
              basedOnShotIds:
                input.plan.agentProposal.basedOnShotIds ??
                [...input.previousShotIds],
            }
          : {}),
        dependencyDrafts: input.plan.agentProposal.dependencyDrafts.map(
          (draft) => ({ ...draft })
        ),
        ...(input.plan.agentProposal.finalPromptDraft
          ? {
              finalPromptDraft: {
                ...input.plan.agentProposal.finalPromptDraft,
              },
            }
          : {}),
      }
    : undefined;
  return {
    ...(input.plan.inputModeId ? { inputModeId: input.plan.inputModeId } : {}),
    ...(input.plan.modelChoice ? { modelChoice: input.plan.modelChoice } : {}),
    ...(input.plan.parameterValues
      ? { parameterValues: { ...input.plan.parameterValues } }
      : {}),
    ...(requestedInputs && requestedInputs.length > 0 ? { requestedInputs } : {}),
    ...(!membershipChanged && input.plan.preparedInputs
      ? {
          preparedInputs: input.plan.preparedInputs.map((preparedInput) => ({
            ...preparedInput,
          })),
        }
      : {}),
    ...(agentProposal ? { agentProposal } : {}),
    ...(input.plan.customPromptNote
      ? { customPromptNote: input.plan.customPromptNote }
      : {}),
  };
}



export function orderProductionGroupsForShotList(
  shots: SceneShot[],
  groups: ShotVideoTakeProductionGroup[]
): ShotVideoTakeProductionGroup[] {
  const shotOrder = new Map(shots.map((shot, index) => [shot.shotId, index]));
  return [...groups].sort((left, right) => {
    const leftIndex = shotOrder.get(left.shotIds[0] ?? '') ?? Infinity;
    const rightIndex = shotOrder.get(right.shotIds[0] ?? '') ?? Infinity;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.productionGroupId.localeCompare(right.productionGroupId);
  });
}
