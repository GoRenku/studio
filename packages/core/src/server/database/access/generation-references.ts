import { eq, isNull } from 'drizzle-orm';
import {
  assetFileGenerations,
  castAssets,
  locationAssets,
  projectAssets,
  projects,
  sceneAssets,
  sequenceAssets,
} from '../../schema/index.js';
import { listAssetFileRecords, readAssetFileRecord } from './asset-files.js';
import { listAssetRecords, readAssetRecord } from './assets.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface GenerationReferenceAssetFileRecord {
  asset: NonNullable<ReturnType<typeof readAssetRecord>>;
  file: NonNullable<ReturnType<typeof readAssetFileRecord>>;
  owner: { kind: string; id: string; role: string } | null;
  generationRunId: string | null;
}

export function listGenerationReferenceAssetFileRecords(
  session: DatabaseSession
): GenerationReferenceAssetFileRecord[] {
  const assets = new Map(
    listAssetRecords(session).map((asset) => [asset.id, asset])
  );
  const owners = readAssetOwners(session);
  const provenance = new Map(
    session.db
      .select()
      .from(assetFileGenerations)
      .all()
      .map((record) => [record.assetFileId, record.mediaGenerationRunId])
  );
  return listAssetFileRecords(session).flatMap((file) => {
    const asset = assets.get(file.assetId);
    return asset
      ? [{
          asset,
          file,
          owner: owners.get(file.assetId) ?? null,
          generationRunId: provenance.get(file.id) ?? null,
        }]
      : [];
  });
}

export function readGenerationReferenceAssetFileRecord(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string }
): GenerationReferenceAssetFileRecord | null {
  const asset = readAssetRecord(session, input.assetId);
  const file = readAssetFileRecord(session, input);
  if (!asset || asset.discardedAt || !file) {
    return null;
  }
  const generation = session.db
    .select()
    .from(assetFileGenerations)
    .where(eq(assetFileGenerations.assetFileId, file.id))
    .get();
  return {
    asset,
    file,
    owner: readAssetOwners(session).get(asset.id) ?? null,
    generationRunId: generation?.mediaGenerationRunId ?? null,
  };
}

function readAssetOwners(session: DatabaseSession): Map<
  string,
  { kind: string; id: string; role: string }
> {
  const projectId = session.db.select({ id: projects.id }).from(projects).get()?.id;
  const owners = new Map<string, { kind: string; id: string; role: string }>();
  const relationshipGroups = [
    session.db.select().from(projectAssets).where(isNull(projectAssets.discardedAt)).all().map((row) => ({
      assetId: row.assetId,
      kind: 'project',
      id: projectId ?? 'project',
      role: row.role,
    })),
    session.db.select().from(castAssets).where(isNull(castAssets.discardedAt)).all().map((row) => ({
      assetId: row.assetId,
      kind: 'castMember',
      id: row.castMemberId,
      role: row.role,
    })),
    session.db.select().from(locationAssets).where(isNull(locationAssets.discardedAt)).all().map((row) => ({
      assetId: row.assetId,
      kind: 'location',
      id: row.locationId,
      role: row.role,
    })),
    session.db.select().from(sequenceAssets).where(isNull(sequenceAssets.discardedAt)).all().map((row) => ({
      assetId: row.assetId,
      kind: 'sequence',
      id: row.sequenceId,
      role: row.role,
    })),
    session.db.select().from(sceneAssets).where(isNull(sceneAssets.discardedAt)).all().map((row) => ({
      assetId: row.assetId,
      kind: 'scene',
      id: row.sceneId,
      role: row.role,
    })),
  ];
  for (const relationships of relationshipGroups) {
    for (const relationship of relationships) {
      if (!owners.has(relationship.assetId)) {
        owners.set(relationship.assetId, relationship);
      }
    }
  }
  return owners;
}
