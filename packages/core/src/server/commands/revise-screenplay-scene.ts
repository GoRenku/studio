import type {
  ScreenplayCommandReport,
  ScreenplaySceneRevisionDocument,
} from '../../client/screenplay.js';
import {
  buildScreenplayDraftForOperations,
  calculateScreenplayShotListImpacts,
} from './apply-screenplay-operations.js';
import { replaceScreenplayDocument, resolveScreenplayDocumentIds } from '../database/access/screenplay-persistence.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { insertScreenplayRevisionRecord } from '../database/access/screenplay-revisions.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { validateScreenplayJsonDocument } from '../screenplay-json/validator.js';

export async function reviseScreenplayScene(
  input: RenkuConfigPathOptions & {
    sceneId: string;
    document: ScreenplaySceneRevisionDocument;
    filePath?: string;
    dryRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<ScreenplayCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = validateScreenplayJsonDocument({
      value: input.document,
      kind: 'screenplaySceneRevision',
      filePath: input.filePath,
    }).filter((issue) => issue.severity === 'warning');
    if (input.document.scene.id !== input.sceneId) {
      throw new ProjectDataError(
        'PROJECT_DATA232',
        'Screenplay scene revision document scene id does not match --scene.',
        { suggestion: 'Use the same scene id in --scene and scene.id.' }
      );
    }
    const base = readScreenplayDocumentFromSession(session);
    if (!base) {
      throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
        suggestion: 'Use `renku screenplay create` before applying revisions.',
      });
    }
    const operationDocument = {
      kind: 'screenplayOperations' as const,
      operations: [
        { operation: 'scene.update' as const, scene: input.document.scene },
      ],
    };
    const { draft, changes } = buildScreenplayDraftForOperations(
      base,
      operationDocument
    );
    const resolved = resolveScreenplayDocumentIds({
      document: draft,
      existing: base,
      idGenerator: input.idGenerator,
      mode: 'mutation',
    });
    const shotListImpacts = calculateScreenplayShotListImpacts({
      session,
      before: base,
      after: resolved.document,
      sceneIds: [input.sceneId],
    });
    if (!input.dryRun) {
      const now = new Date().toISOString();
      const ids = createUniqueIdAllocator(
        input.idGenerator ?? createRandomIdGenerator()
      );
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        replaceScreenplayDocument(txSession, resolved.document);
        insertScreenplayRevisionRecord({
          session: txSession,
          id: ids('screenplay_revision'),
          document: resolved.document,
          sourceCommand: 'screenplay.scene.revise',
          summary: input.document.scene.title,
          now,
        });
      });
    }
    return {
      valid: true,
      warnings: [...warnings, ...resolved.warnings],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      changes,
      generatedIds: resolved.generatedIds,
      resourceKeys: ['screenplay', `scene:${input.sceneId}`],
      shotListImpacts,
    };
  });
}
