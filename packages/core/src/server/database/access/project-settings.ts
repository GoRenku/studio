import { eq } from 'drizzle-orm';
import { projectSettings } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type ProjectSettingsRecord = typeof projectSettings.$inferSelect;

export function readProjectSettingsRecord(
  session: DatabaseSession
): ProjectSettingsRecord | null {
  return (
    session.db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.singletonId, 1))
      .get() ?? null
  );
}

export function insertProjectSettingsRecord(
  session: DatabaseSession,
  document: string
): void {
  session.db
    .insert(projectSettings)
    .values({ singletonId: 1, document })
    .run();
}

export function replaceProjectSettingsRecord(
  session: DatabaseSession,
  document: string
): void {
  session.db
    .update(projectSettings)
    .set({ document })
    .where(eq(projectSettings.singletonId, 1))
    .run();
}
