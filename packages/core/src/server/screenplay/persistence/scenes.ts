import { asc, eq, inArray, notInArray } from 'drizzle-orm';
import type { Scene } from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { scenes } from '../../schema/index.js';
import { parseStoredSceneBlocksJson } from '../validation/blocks.js';

export function readSceneRecords(session: DatabaseSession): Scene[] {
  return session.db
    .select()
    .from(scenes)
    .orderBy(asc(scenes.id))
    .all()
    .map((row) => ({
      id: row.id,
      ...(row.productionNumber !== null ? { productionNumber: row.productionNumber } : {}),
      heading: row.heading,
      ...(row.title ? { title: row.title } : {}),
      blocks: parseStoredSceneBlocksJson(row.blocksJson, row.id),
    }));
}

export function readSceneRecord(
  session: DatabaseSession,
  sceneId: string,
): Scene | null {
  const row = session.db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    ...(row.productionNumber !== null ? { productionNumber: row.productionNumber } : {}),
    heading: row.heading,
    ...(row.title ? { title: row.title } : {}),
    blocks: parseStoredSceneBlocksJson(row.blocksJson, row.id),
  };
}

export function replaceSceneRecords(
  session: DatabaseSession,
  values: Scene[],
): void {
  for (const scene of values) {
    const record = {
      id: scene.id,
      productionNumber: scene.productionNumber ?? null,
      heading: scene.heading,
      title: scene.title ?? null,
      blocksJson: JSON.stringify(scene.blocks),
    };
    const existing = session.db
      .select({ id: scenes.id })
      .from(scenes)
      .where(eq(scenes.id, scene.id))
      .get();
    if (existing) {
      session.db.update(scenes).set(record).where(eq(scenes.id, scene.id)).run();
    } else {
      session.db.insert(scenes).values(record).run();
    }
  }

  const ids = values.map((scene) => scene.id);
  if (ids.length === 0) {
    session.db.delete(scenes).run();
  } else {
    session.db.delete(scenes).where(notInArray(scenes.id, ids)).run();
  }
}

export function listExistingSceneIds(
  session: DatabaseSession,
  sceneIds: string[],
): Set<string> {
  if (sceneIds.length === 0) {
    return new Set();
  }
  return new Set(
    session.db
      .select({ id: scenes.id })
      .from(scenes)
      .where(inArray(scenes.id, sceneIds))
      .all()
      .map((row) => row.id),
  );
}
