import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  GarbageCollectionPreview,
  GarbageCollectionReport,
  RecoverableMutationReport,
  TrashActorKind,
  TrashItem,
  TrashItemKind,
  TrashListReport,
  TrashProjectReport,
} from '../../client/index.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { trashItems, trashOperations } from '../schema/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { TrashProjectContext } from './trash-object-definition.js';
import { getTrashObjectDefinition } from './trash-object-registry.js';
import { trashPackageFilePath, stageTrashFiles } from './trash-file-staging.js';
import { trashManifestProjectRelativePath, writeTrashManifest } from './trash-manifest.js';

export interface DiscardTrashObjectInput extends TrashProjectContext {
  session: DatabaseSession;
  itemKind: TrashItemKind;
  itemId: string;
  commandName: string;
  changes: RecoverableMutationReport['changes'];
  resourceKeys?: string[];
  actorKind?: TrashActorKind;
  actorLabel?: string | null;
  reason?: string | null;
}

export function discardTrashObject(
  input: DiscardTrashObjectInput
): RecoverableMutationReport {
  const definition = getTrashObjectDefinition(input.itemKind);
  const ids = createUniqueIdAllocator(createRandomIdGenerator());
  const operationId = ids('trash_operation');
  const now = new Date().toISOString();
  const context = {
    session: input.session,
    project: input.project,
    projectFolder: input.projectFolder,
    itemId: input.itemId,
    operationId,
    now,
  };
  const drafts = definition.readTrashItems(context);
  if (drafts.length === 0) {
    throw new ProjectDataError(
      'PROJECT_DATA261',
      `Trash object was not found: ${input.itemKind} ${input.itemId}.`
    );
  }
  const primaryDraft =
    drafts.find(
      (draft) => draft.itemKind === input.itemKind && draft.itemId === input.itemId
    ) ?? drafts[0];
  let trashItemIds: string[] = [];
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    const txContext = { ...context, session: txSession };
    tx.insert(trashOperations)
      .values({
        id: operationId,
        commandName: input.commandName,
        actorKind: input.actorKind ?? 'user',
        actorLabel: input.actorLabel ?? null,
        reason: input.reason ?? null,
        createdAt: now,
      })
      .run();
    definition.applyDiscard(txContext);
    trashItemIds = drafts.map((draft) => ids('trash_item'));
    drafts.forEach((draft, index) => {
      tx.insert(trashItems)
        .values({
          id: trashItemIds[index]!,
          operationId,
          itemKind: draft.itemKind,
          itemId: draft.itemId,
          ownerKind: draft.ownerKind ?? null,
          ownerId: draft.ownerId ?? null,
          title: draft.title,
          originalProjectRelativePath: draft.originalProjectRelativePath ?? null,
          restoreSnapshotJson: JSON.stringify(draft.restoreSnapshot),
          createdAt: now,
        })
        .run();
    });
  });
  return recoverableReport({
    project: input.project,
    projectFolder: input.projectFolder,
    operationId,
    trashItemIds,
    changes: input.changes,
    resourceKeys:
      input.resourceKeys ??
      definition.resourceKeys({
        itemId: input.itemId,
        ownerKind: primaryDraft?.ownerKind ?? null,
        ownerId: primaryDraft?.ownerId ?? null,
      }),
  });
}

export function listTrash(input: TrashProjectContext & {
  session: DatabaseSession;
}): TrashListReport {
  return {
    valid: true,
    warnings: [],
    project: toProjectReport(input),
    items: listActiveTrashItemRows(input.session).map(stripTrashItemSnapshot),
    resourceKeys: ['trash:list'],
  };
}

export function restoreTrashItem(input: TrashProjectContext & {
  session: DatabaseSession;
  trashItemId: string;
}): RecoverableMutationReport {
  const item = readActiveTrashItem(input.session, input.trashItemId);
  return restoreTrashItemRow({ ...input, item });
}

export function restoreTrashObject(input: TrashProjectContext & {
  session: DatabaseSession;
  itemKind: TrashItemKind;
  itemId: string;
}): RecoverableMutationReport {
  const item = readActiveTrashItemByObject(input.session, {
    itemKind: input.itemKind,
    itemId: input.itemId,
  });
  return restoreTrashItemRow({ ...input, item });
}

function restoreTrashItemRow(input: TrashProjectContext & {
  session: DatabaseSession;
  item: TrashItemWithSnapshot;
}): RecoverableMutationReport {
  const item = input.item;
  const definition = getTrashObjectDefinition(item.itemKind);
  const now = new Date().toISOString();
  const snapshot = parseRestoreSnapshot(item);
  let warnings: DiagnosticIssue[] = [];
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    warnings = definition.applyRestore({
      session: txSession,
      project: input.project,
      projectFolder: input.projectFolder,
      trashItem: item,
      snapshot,
      now,
    }) ?? [];
    tx.update(trashItems)
      .set({ restoredAt: now })
      .where(eq(trashItems.id, item.id))
      .run();
    const remaining = tx
      .select({ id: trashItems.id })
      .from(trashItems)
      .where(
        and(
          eq(trashItems.operationId, item.operationId),
          isNull(trashItems.restoredAt),
          isNull(trashItems.garbageCollectedAt)
        )
      )
      .all();
    if (remaining.length === 0) {
      tx.update(trashOperations)
        .set({ restoredAt: now })
        .where(eq(trashOperations.id, item.operationId))
        .run();
    }
  });
  return recoverableReport({
    project: input.project,
    projectFolder: input.projectFolder,
    operationId: item.operationId,
    trashItemIds: [item.id],
    changes: definition.restoredChanges({ itemId: item.itemId }),
    resourceKeys: definition.resourceKeys({
      itemId: item.itemId,
      ownerKind: item.ownerKind,
      ownerId: item.ownerId,
    }),
    warnings,
  });
}

export function previewGarbageCollection(input: TrashProjectContext & {
  session: DatabaseSession;
  olderThanIso?: string;
}): GarbageCollectionPreview {
  const internalItems = listActiveTrashItemRows(input.session).filter((item) =>
    input.olderThanIso ? item.createdAt < input.olderThanIso : true
  );
  const operationId = createUniqueIdAllocator(createRandomIdGenerator())(
    'trash_operation'
  );
  const files = collectGarbageCollectionFiles({
    ...input,
    items: internalItems,
    operationId,
  });
  const items = internalItems.map(stripTrashItemSnapshot);
  const preview = {
    valid: true as const,
    warnings: [],
    project: toProjectReport(input),
    confirmationToken: confirmationToken({ olderThanIso: input.olderThanIso, items }),
    items,
    files,
    resourceKeys: ['trash:list'],
  };
  return preview;
}

export async function emptyTrash(input: TrashProjectContext & {
  session: DatabaseSession;
  confirmationToken: string;
  olderThanIso?: string;
  dryRun?: boolean;
}): Promise<GarbageCollectionReport> {
  const preview = previewGarbageCollection(input);
  if (preview.confirmationToken !== input.confirmationToken) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      'Empty Trash confirmation token does not match the current preview.',
      {
        suggestion:
          'Run trash empty preview again and pass the returned confirmation token.',
      }
    );
  }
  const operationId = createUniqueIdAllocator(createRandomIdGenerator())(
    'trash_operation'
  );
  const files = preview.files.map((file) => ({
    ...file,
    trashProjectRelativePath: trashPackageFilePath({
      operationId,
      originalProjectRelativePath: file.originalProjectRelativePath,
    }),
  }));
  const dryRun = input.dryRun === true;
  await stageTrashFiles({
    projectFolder: input.projectFolder,
    operationId,
    files,
    dryRun,
  });
  const manifestProjectRelativePath = dryRun
    ? trashManifestProjectRelativePath(operationId)
    : await writeTrashManifest({
        projectFolder: input.projectFolder,
        project: preview.project,
        operationId,
        items: preview.items,
        files,
        createdAt: new Date().toISOString(),
        dryRun,
      });
  if (!dryRun) {
    const now = new Date().toISOString();
    input.session.db.transaction((tx) => {
      for (const item of preview.items) {
        tx.update(trashItems)
          .set({
            garbageCollectedAt: now,
            trashProjectRelativePath:
              files.find((file) => file.trashItemId === item.id)
                ?.trashProjectRelativePath ?? null,
          })
          .where(eq(trashItems.id, item.id))
          .run();
        tx.update(trashOperations)
          .set({ garbageCollectedAt: now })
          .where(eq(trashOperations.id, item.operationId))
          .run();
      }
    });
  }
  return {
    ...preview,
    dryRun,
    operationId,
    files,
    manifestProjectRelativePath,
  };
}

function collectGarbageCollectionFiles(input: TrashProjectContext & {
  session: DatabaseSession;
  items: TrashItemWithSnapshot[];
  operationId: string;
}): GarbageCollectionPreview['files'] {
  const files: GarbageCollectionPreview['files'] = [];
  for (const item of input.items) {
    const definition = getTrashObjectDefinition(item.itemKind);
    const snapshot = parseRestoreSnapshot(item);
    for (const file of definition.collectFiles({
      session: input.session,
      project: input.project,
      projectFolder: input.projectFolder,
      trashItem: item,
      snapshot,
    })) {
      files.push({
        trashItemId: item.id,
        originalProjectRelativePath: file.originalProjectRelativePath,
        trashProjectRelativePath: trashPackageFilePath({
          operationId: input.operationId,
          originalProjectRelativePath: file.originalProjectRelativePath,
        }),
      });
    }
  }
  return files;
}

type TrashItemWithSnapshot = TrashItem & { restoreSnapshotJson: string };

function listActiveTrashItemRows(session: DatabaseSession): TrashItemWithSnapshot[] {
  return session.db
    .select()
    .from(trashItems)
    .where(and(isNull(trashItems.restoredAt), isNull(trashItems.garbageCollectedAt)))
    .all()
    .map(toTrashItemWithSnapshot);
}

function readActiveTrashItem(
  session: DatabaseSession,
  trashItemId: string
): TrashItemWithSnapshot {
  const row = session.db
    .select()
    .from(trashItems)
    .where(
      and(
        eq(trashItems.id, trashItemId),
        isNull(trashItems.restoredAt),
        isNull(trashItems.garbageCollectedAt)
      )
    )
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA263',
      `Active trash item was not found: ${trashItemId}.`
    );
  }
  return toTrashItemWithSnapshot(row);
}

function readActiveTrashItemByObject(
  session: DatabaseSession,
  input: { itemKind: TrashItemKind; itemId: string }
): TrashItemWithSnapshot {
  const row = session.db
    .select()
    .from(trashItems)
    .where(
      and(
        eq(trashItems.itemKind, input.itemKind),
        eq(trashItems.itemId, input.itemId),
        isNull(trashItems.restoredAt),
        isNull(trashItems.garbageCollectedAt)
      )
    )
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA276',
      `Active trash item was not found for ${input.itemKind}: ${input.itemId}.`
    );
  }
  return toTrashItemWithSnapshot(row);
}

function parseRestoreSnapshot(item: TrashItemWithSnapshot): Record<string, unknown> {
  const json = item.restoreSnapshotJson;
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProjectDataError(
      'PROJECT_DATA264',
      `Trash item restore snapshot is invalid: ${item.id}.`
    );
  }
  return parsed as Record<string, unknown>;
}

function toTrashItemWithSnapshot(
  row: typeof trashItems.$inferSelect
): TrashItemWithSnapshot {
  return {
    id: row.id,
    operationId: row.operationId,
    itemKind: row.itemKind as TrashItemKind,
    itemId: row.itemId,
    ownerKind: row.ownerKind,
    ownerId: row.ownerId,
    title: row.title,
    originalProjectRelativePath: row.originalProjectRelativePath,
    trashProjectRelativePath: row.trashProjectRelativePath,
    createdAt: row.createdAt,
    restoredAt: row.restoredAt,
    garbageCollectedAt: row.garbageCollectedAt,
    restoreSnapshotJson: row.restoreSnapshotJson,
  };
}

function stripTrashItemSnapshot(item: TrashItemWithSnapshot): TrashItem {
  const { restoreSnapshotJson: _restoreSnapshotJson, ...publicItem } = item;
  return publicItem;
}

function recoverableReport(input: {
  project: TrashProjectContext['project'];
  projectFolder: string;
  operationId: string;
  trashItemIds: string[];
  changes: RecoverableMutationReport['changes'];
  resourceKeys: string[];
  warnings?: DiagnosticIssue[];
}): RecoverableMutationReport {
  return {
    valid: true,
    warnings: input.warnings ?? [],
    project: toProjectReport(input),
    changes: input.changes,
    recovery: {
      operationId: input.operationId,
      trashItemIds: input.trashItemIds,
      restorable: input.trashItemIds.length > 0,
      restoreCommand: {
        name: 'trash.restore',
        trashItemId: input.trashItemIds[0] ?? '',
      },
    },
    resourceKeys: input.resourceKeys,
  };
}

function toProjectReport(input: TrashProjectContext): TrashProjectReport {
  return {
    id: input.project.id,
    name: input.project.name,
    projectFolder: input.projectFolder,
  };
}

function confirmationToken(input: {
  olderThanIso?: string;
  items: TrashItem[];
}): string {
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        olderThanIso: input.olderThanIso ?? null,
        items: input.items.map((item) => item.id).sort(),
      })
    )
    .digest('hex');
  return `sha256:${hash}`;
}
