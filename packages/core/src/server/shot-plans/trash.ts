import { and, eq, isNull } from 'drizzle-orm';
import { shotPlans } from '../schema/index.js';
import { studioSceneShotsResourceKey } from '../studio-coordination/resource-keys.js';
import type { TrashObjectDefinition } from '../trash/trash-object-definition.js';
import { ProjectDataError } from '../project-data-error.js';

export const shotPlanTrashDefinition: TrashObjectDefinition = {
  itemKind: 'shotPlan',
  readTrashItems(input) {
    const shotPlan = input.session.db
      .select()
      .from(shotPlans)
      .where(
        and(eq(shotPlans.id, input.itemId), isNull(shotPlans.discardedAt))
      )
      .get();
    if (!shotPlan) {
      return [];
    }
    return [
      {
        itemKind: 'shotPlan',
        itemId: shotPlan.id,
        ownerKind: 'scene',
        ownerId: shotPlan.sceneId,
        title: shotPlan.title,
        restoreSnapshot: {
          sceneId: shotPlan.sceneId,
        },
      },
    ];
  },
  applyDiscard(input) {
    const shotPlan = input.session.db
      .select()
      .from(shotPlans)
      .where(eq(shotPlans.id, input.itemId))
      .get();
    if (!shotPlan) {
      return;
    }
    input.session.db
      .update(shotPlans)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(shotPlans.id, input.itemId))
      .run();
  },
  applyRestore(input) {
    input.session.db
      .update(shotPlans)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(shotPlans.id, input.trashItem.itemId),
          eq(shotPlans.discardOperationId, input.trashItem.operationId)
        )
      )
      .run();
  },
  collectFiles() {
    return [];
  },
  resourceKeys(input) {
    if (!input.ownerId) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_STORAGE_INVALID',
        `Shot Plan Trash item is missing its Scene owner: ${input.itemId}.`
      );
    }
    return [studioSceneShotsResourceKey(input.ownerId)];
  },
  restoredChanges(input) {
    return [{ type: 'shotPlan.restored', shotPlanId: input.itemId }];
  },
};
