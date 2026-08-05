import { eq } from 'drizzle-orm';
import { projects } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type ProjectRecord = typeof projects.$inferSelect;

export interface InsertProjectRecord {
  id: string;
  projectName: string;
  title: string;
  aspectRatio: string;
  logline?: string | null;
  synopsis?: string | null;
  premise?: string | null;
  intendedAudience?: string | null;
  format?: string | null;
  targetRuntimeMinutes?: number | null;
  primaryGenre?: string | null;
  secondaryGenresJson?: string | null;
  tonesJson?: string | null;
  contentRatingIntent?: string | null;
  creativeBoundariesJson?: string | null;
  centralConflict?: string | null;
  dramaticQuestion?: string | null;
  themesJson?: string | null;
  historicalBasisJson?: string | null;
  dramatizedElementsJson?: string | null;
  screenplayDraftStatus?: string | null;
  researchSourcesJson?: string | null;
  assumptionsJson?: string | null;
  openQuestionsJson?: string | null;
  nextStepsJson?: string | null;
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
  title?: string;
  aspectRatio?: string;
  logline?: string | null;
  synopsis?: string | null;
  premise?: string | null;
  intendedAudience?: string | null;
  format?: string | null;
  targetRuntimeMinutes?: number | null;
  primaryGenre?: string | null;
  secondaryGenresJson?: string | null;
  tonesJson?: string | null;
  contentRatingIntent?: string | null;
  creativeBoundariesJson?: string | null;
  centralConflict?: string | null;
  dramaticQuestion?: string | null;
  themesJson?: string | null;
  historicalBasisJson?: string | null;
  dramatizedElementsJson?: string | null;
  screenplayDraftStatus?: string | null;
  researchSourcesJson?: string | null;
  assumptionsJson?: string | null;
  openQuestionsJson?: string | null;
  nextStepsJson?: string | null;
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
