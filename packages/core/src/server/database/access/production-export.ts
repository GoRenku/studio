import { and, asc, eq } from 'drizzle-orm';
import {
  assetFiles,
  assets,
  projectAssets,
  projectLocales,
  projects,
  sceneAssets,
  scenes,
  sequenceAssets,
  sequences,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface SelectedProductionAssetRow {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  targetKind: 'project' | 'castMember' | 'sequence' | 'scene';
  targetId: string | null;
  localeId: string | null;
  localeTag: string | null;
  role: string;
  selectionOrder: number;
  title: string;
  sourceProjectRelativePath: string;
  mediaKind: string;
  sourceSizeBytes: number | null;
  sourceContentHash: string | null;
}

export function readProductionProjectInfo(session: DatabaseSession): { id: string } {
  const row = session.db.select({ id: projects.id }).from(projects).limit(1).get();
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA102', 'Project database has no project row.');
  }
  return row;
}

export function assertProductionExportLocaleExists(
  session: DatabaseSession,
  localeId: string
): void {
  const row = session.db
    .select({ id: projectLocales.id })
    .from(projectLocales)
    .where(eq(projectLocales.id, localeId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA103',
      `Requested production export locale was not found: ${localeId}.`
    );
  }
}

export function readProductionLocaleTag(
  session: DatabaseSession,
  localeId: string
): string {
  const row = session.db
    .select({ localeTag: projectLocales.localeTag })
    .from(projectLocales)
    .where(eq(projectLocales.id, localeId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA103',
      `Requested production export locale was not found: ${localeId}.`
    );
  }
  return row.localeTag;
}

export function readSelectedProductionAssetRows(
  session: DatabaseSession
): SelectedProductionAssetRow[] {
  return [
    ...readProjectSelectedAssetRows(session),
    ...readSequenceSelectedAssetRows(session),
    ...readSceneSelectedAssetRows(session),
  ].sort(compareSelectedAssetRows);
}

export function refreshProductionAssetFileMetadata(input: {
  session: DatabaseSession;
  assetFileId: string;
  contentHash: string;
  sizeBytes: number;
}): void {
  input.session.db
    .update(assetFiles)
    .set({
      contentHash: input.contentHash,
      sizeBytes: input.sizeBytes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assetFiles.id, input.assetFileId))
    .run();
}

export function readSequenceProductionHierarchy(
  session: DatabaseSession,
  sequenceId: string
): {
  sequencePosition: number;
  sequenceTitle: string;
} {
  const row = session.db
    .select({
      sequencePosition: sequences.position,
      sequenceTitle: sequences.title,
    })
    .from(sequences)
    .where(eq(sequences.id, sequenceId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA108',
      `Sequence target was not found for production export: ${sequenceId}.`
    );
  }
  return row;
}

export function readSceneProductionHierarchy(
  session: DatabaseSession,
  sceneId: string
): {
  sequencePosition: number;
  sequenceTitle: string;
  scenePosition: number;
  sceneTitle: string;
} {
  const row = session.db
    .select({
      sequencePosition: sequences.position,
      sequenceTitle: sequences.title,
      scenePosition: scenes.position,
      sceneTitle: scenes.title,
    })
    .from(scenes)
    .innerJoin(sequences, eq(sequences.id, scenes.sequenceId))
    .where(eq(scenes.id, sceneId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA109',
      `Scene target was not found for production export: ${sceneId}.`
    );
  }
  return row;
}

function readProjectSelectedAssetRows(
  session: DatabaseSession
): SelectedProductionAssetRow[] {
  return session.db
    .select({
      assetId: assets.id,
      relationshipId: projectAssets.id,
      assetFileId: assetFiles.id,
      localeId: projectAssets.localeId,
      localeTag: projectLocales.localeTag,
      role: projectAssets.role,
      selectionOrder: projectAssets.selectionOrder,
      title: assets.title,
      sourceProjectRelativePath: assetFiles.projectRelativePath,
      mediaKind: assetFiles.mediaKind,
      sourceSizeBytes: assetFiles.sizeBytes,
      sourceContentHash: assetFiles.contentHash,
    })
    .from(projectAssets)
    .innerJoin(assets, eq(assets.id, projectAssets.assetId))
    .innerJoin(assetFiles, eq(assetFiles.assetId, assets.id))
    .leftJoin(projectLocales, eq(projectLocales.id, projectAssets.localeId))
    .where(and(eq(projectAssets.selection, 'select'), eq(assets.availability, 'ready')))
    .orderBy(
      asc(projectAssets.role),
      asc(projectAssets.selectionOrder),
      asc(projectAssets.assetId)
    )
    .all()
    .map((row) => ({
      ...row,
      targetKind: 'project' as const,
      targetId: null,
      selectionOrder: row.selectionOrder ?? 1,
    }));
}

function readSequenceSelectedAssetRows(
  session: DatabaseSession
): SelectedProductionAssetRow[] {
  return session.db
    .select({
      assetId: assets.id,
      relationshipId: sequenceAssets.id,
      assetFileId: assetFiles.id,
      targetId: sequenceAssets.sequenceId,
      localeId: sequenceAssets.localeId,
      localeTag: projectLocales.localeTag,
      role: sequenceAssets.role,
      selectionOrder: sequenceAssets.selectionOrder,
      title: assets.title,
      sourceProjectRelativePath: assetFiles.projectRelativePath,
      mediaKind: assetFiles.mediaKind,
      sourceSizeBytes: assetFiles.sizeBytes,
      sourceContentHash: assetFiles.contentHash,
    })
    .from(sequenceAssets)
    .innerJoin(assets, eq(assets.id, sequenceAssets.assetId))
    .innerJoin(assetFiles, eq(assetFiles.assetId, assets.id))
    .leftJoin(projectLocales, eq(projectLocales.id, sequenceAssets.localeId))
    .where(and(eq(sequenceAssets.selection, 'select'), eq(assets.availability, 'ready')))
    .orderBy(
      asc(sequenceAssets.sequenceId),
      asc(sequenceAssets.role),
      asc(sequenceAssets.selectionOrder),
      asc(sequenceAssets.assetId)
    )
    .all()
    .map((row) => ({
      ...row,
      targetKind: 'sequence' as const,
      selectionOrder: row.selectionOrder ?? 1,
    }));
}

function readSceneSelectedAssetRows(
  session: DatabaseSession
): SelectedProductionAssetRow[] {
  return session.db
    .select({
      assetId: assets.id,
      relationshipId: sceneAssets.id,
      assetFileId: assetFiles.id,
      targetId: sceneAssets.sceneId,
      localeId: sceneAssets.localeId,
      localeTag: projectLocales.localeTag,
      role: sceneAssets.role,
      selectionOrder: sceneAssets.selectionOrder,
      title: assets.title,
      sourceProjectRelativePath: assetFiles.projectRelativePath,
      mediaKind: assetFiles.mediaKind,
      sourceSizeBytes: assetFiles.sizeBytes,
      sourceContentHash: assetFiles.contentHash,
    })
    .from(sceneAssets)
    .innerJoin(assets, eq(assets.id, sceneAssets.assetId))
    .innerJoin(assetFiles, eq(assetFiles.assetId, assets.id))
    .leftJoin(projectLocales, eq(projectLocales.id, sceneAssets.localeId))
    .where(and(eq(sceneAssets.selection, 'select'), eq(assets.availability, 'ready')))
    .orderBy(
      asc(sceneAssets.sceneId),
      asc(sceneAssets.role),
      asc(sceneAssets.selectionOrder),
      asc(sceneAssets.assetId)
    )
    .all()
    .map((row) => ({
      ...row,
      targetKind: 'scene' as const,
      selectionOrder: row.selectionOrder ?? 1,
    }));
}

function compareSelectedAssetRows(
  left: SelectedProductionAssetRow,
  right: SelectedProductionAssetRow
): number {
  return (
    left.targetKind.localeCompare(right.targetKind) ||
    String(left.targetId ?? '').localeCompare(String(right.targetId ?? '')) ||
    left.role.localeCompare(right.role) ||
    left.selectionOrder - right.selectionOrder ||
    left.assetId.localeCompare(right.assetId)
  );
}
