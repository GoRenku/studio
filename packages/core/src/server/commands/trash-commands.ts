import type {
  GarbageCollectionPreview,
  GarbageCollectionReport,
  RecoverableMutationReport,
  TrashListReport,
} from '../../client/index.js';
import {
  readProjectRecord,
  type ProjectRecord,
} from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  EmptyTrashInput,
  ListTrashInput,
  PreviewGarbageCollectionInput,
  RestoreTrashItemInput,
} from '../project-data-service-contracts.js';
import {
  emptyTrash as emptyTrashInSession,
  listTrash as listTrashInSession,
  previewGarbageCollection as previewGarbageCollectionInSession,
  restoreTrashItem as restoreTrashItemInSession,
} from '../trash/trash-lifecycle-service.js';

export async function listTrash(input: ListTrashInput): Promise<TrashListReport> {
  return withTrashSession(input, ({ session, projectFolder, project }) =>
    listTrashInSession({ session, projectFolder, project })
  );
}

export async function restoreTrashItem(
  input: RestoreTrashItemInput
): Promise<RecoverableMutationReport> {
  return withTrashSession(input, ({ session, projectFolder, project }) =>
    restoreTrashItemInSession({
      session,
      projectFolder,
      project,
      trashItemId: input.trashItemId,
    })
  );
}

export async function previewGarbageCollection(
  input: PreviewGarbageCollectionInput
): Promise<GarbageCollectionPreview> {
  return withTrashSession(input, ({ session, projectFolder, project }) =>
    previewGarbageCollectionInSession({
      session,
      projectFolder,
      project,
      olderThanIso: input.olderThanIso,
    })
  );
}

export async function emptyTrash(
  input: EmptyTrashInput
): Promise<GarbageCollectionReport> {
  return withTrashSession(input, ({ session, projectFolder, project }) =>
    emptyTrashInSession({
      session,
      projectFolder,
      project,
      olderThanIso: input.olderThanIso,
      confirmationToken: input.confirmationToken,
      dryRun: input.dryRun,
    })
  );
}

async function withTrashSession<T>(
  input: { projectName: string; homeDir?: string },
  fn: (handle: {
    projectFolder: string;
    project: Pick<ProjectRecord, 'id' | 'name'>;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  const handle = await openProjectSession(input);
  try {
    return await fn({
      ...handle,
      project: requireProjectRecord(handle.session),
    });
  } finally {
    handle.session.close();
  }
}

function requireProjectRecord(session: DatabaseSession): ProjectRecord {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return project;
}
