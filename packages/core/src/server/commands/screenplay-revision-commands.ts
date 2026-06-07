import type {
  ScreenplayCommandReport,
  ScreenplayDocument,
  ScreenplayRevisionListReport,
  ScreenplayRevisionReadReport,
} from '../../client/screenplay.js';
import { calculateScreenplayShotListImpacts } from './apply-screenplay-operations.js';
import { replaceScreenplayDocument } from '../database/access/screenplay-persistence.js';
import {
  insertScreenplayRevisionRecord,
  listScreenplayRevisionRecords,
  readScreenplayRevisionDocument,
  requireScreenplayRevisionRecord,
  toScreenplayRevisionSummary,
} from '../database/access/screenplay-revisions.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export async function listScreenplayRevisions(
  input: RenkuConfigPathOptions = {}
): Promise<ScreenplayRevisionListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => ({
    valid: true,
    warnings: [],
    project: { name: currentProject.projectName, id: currentProject.projectId },
    resourceKeys: ['screenplay'],
    revisions: listScreenplayRevisionRecords(session),
  }));
}

export async function readScreenplayRevision(
  input: RenkuConfigPathOptions & { revisionId: string }
): Promise<ScreenplayRevisionReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const row = requireScreenplayRevisionRecord(session, input.revisionId);
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: ['screenplay'],
      revision: toScreenplayRevisionSummary(row),
      screenplay: readScreenplayRevisionDocument(row),
    };
  });
}

export async function restoreScreenplayRevision(
  input: RenkuConfigPathOptions & {
    revisionId: string;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<ScreenplayCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const base = readScreenplayDocumentFromSession(session);
    if (!base) {
      throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
        suggestion: 'Use `renku screenplay create` before restoring revisions.',
      });
    }
    const row = requireScreenplayRevisionRecord(session, input.revisionId);
    const restored = readScreenplayRevisionDocument(row);
    const sceneIds = changedSceneIds(base, restored);
    const shotListImpacts = calculateScreenplayShotListImpacts({
      session,
      before: base,
      after: restored,
      sceneIds,
    });
    const now = new Date().toISOString();
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      replaceScreenplayDocument(txSession, restored);
      insertScreenplayRevisionRecord({
        session: txSession,
        id: ids('screenplay_revision'),
        document: restored,
        sourceCommand: 'screenplay.revision.restore',
        summary: `Restored ${row.id}`,
        now,
      });
    });
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      changes: [
        { operation: 'screenplay.revision.restore', revisionId: row.id },
      ],
      resourceKeys: [
        'screenplay',
        ...sceneIds.map((sceneId) => `scene:${sceneId}`),
      ],
      shotListImpacts,
    };
  });
}

function changedSceneIds(
  before: ScreenplayDocument,
  after: ScreenplayDocument
): string[] {
  const beforeScenes = sceneJsonById(before);
  const afterScenes = sceneJsonById(after);
  const ids = new Set([...beforeScenes.keys(), ...afterScenes.keys()]);
  return [...ids].filter(
    (sceneId) => beforeScenes.get(sceneId) !== afterScenes.get(sceneId)
  );
}

function sceneJsonById(document: ScreenplayDocument): Map<string, string> {
  const scenes = new Map<string, string>();
  for (const act of document.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id) {
          scenes.set(scene.id, JSON.stringify(scene));
        }
      }
    }
  }
  return scenes;
}
