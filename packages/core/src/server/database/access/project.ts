import { eq } from 'drizzle-orm';
import { projects } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type ProjectRecord = typeof projects.$inferSelect;

export interface InsertProjectRecord {
  id: string;
  name: string;
  title: string;
  type: 'standaloneMovie' | 'series';
  logline?: string;
  aspectRatio?: string;
  coverFile: string | null;
  createdAt: string;
  updatedAt: string;
}

export function insertProjectRecord(
  session: DatabaseSession,
  record: InsertProjectRecord
): void {
  session.db.insert(projects).values(record).run();
}

export function readProjectRecord(session: DatabaseSession): ProjectRecord | null {
  return session.db.select().from(projects).get() ?? null;
}

export function readProjectRecordById(
  session: DatabaseSession,
  projectId: string
): ProjectRecord | null {
  return (
    session.db.select().from(projects).where(eq(projects.id, projectId)).get() ?? null
  );
}

export interface UpdateProjectInformationRecord {
  title: string;
  logline: string | null;
  aspectRatio?: string;
  updatedAt: string;
}

export function updateProjectInformationRecord(
  session: DatabaseSession,
  projectId: string,
  record: UpdateProjectInformationRecord
): void {
  session.db
    .update(projects)
    .set(record)
    .where(eq(projects.id, projectId))
    .run();
}
