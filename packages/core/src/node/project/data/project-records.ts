import { eq } from 'drizzle-orm';
import { projects } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type ProjectRecord = typeof projects.$inferSelect;

export interface InsertProjectRecord {
  id: string;
  name: string;
  title: string;
  type: 'standaloneMovie' | 'series';
  logline?: string;
  summary?: string;
  aspectRatio?: string;
  coverFile: string | null;
  createdAt: string;
  updatedAt: string;
}

export function insertProjectRecord(
  session: ProjectDataSession,
  record: InsertProjectRecord
): void {
  session.db.insert(projects).values(record).run();
}

export function readProjectRecord(session: ProjectDataSession): ProjectRecord | null {
  return session.db.select().from(projects).get() ?? null;
}

export function readProjectRecordById(
  session: ProjectDataSession,
  projectId: string
): ProjectRecord | null {
  return (
    session.db.select().from(projects).where(eq(projects.id, projectId)).get() ?? null
  );
}

export interface UpdateProjectInformationRecord {
  title: string;
  logline?: string;
  summary?: string;
  aspectRatio?: string;
  updatedAt: string;
}

export function updateProjectInformationRecord(
  session: ProjectDataSession,
  projectId: string,
  record: UpdateProjectInformationRecord
): void {
  session.db
    .update(projects)
    .set(record)
    .where(eq(projects.id, projectId))
    .run();
}
