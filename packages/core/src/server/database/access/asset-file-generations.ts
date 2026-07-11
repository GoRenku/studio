import { eq } from 'drizzle-orm';
import { assetFileGenerations } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type AssetFileGenerationRecord =
  typeof assetFileGenerations.$inferSelect;

export function readAssetFileGenerationRecord(
  session: DatabaseSession,
  assetFileId: string,
): AssetFileGenerationRecord | null {
  return (
    session.db
      .select()
      .from(assetFileGenerations)
      .where(eq(assetFileGenerations.assetFileId, assetFileId))
      .get() ?? null
  );
}

export function insertAssetFileGenerationRecord(
  session: DatabaseSession,
  record: AssetFileGenerationRecord,
): void {
  session.db.insert(assetFileGenerations).values(record).run();
}
