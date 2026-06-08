import type {
  ScreenplayCommandReport,
  ScreenplayCreateDocument,
  ScreenplayDocument,
} from '../../client/screenplay.js';
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { validateScreenplayJsonDocument } from '../screenplay-json/validator.js';
import {
  readScreenplayDocumentFromSession,
  listScreenplayCastMembersFromSession,
  listScreenplayLocationsFromSession,
} from '../database/access/screenplay-resource.js';
import { replaceScreenplayDocument, resolveScreenplayDocumentIds } from '../database/access/screenplay-persistence.js';
import { insertScreenplayRevisionRecord } from '../database/access/screenplay-revisions.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';

export async function createScreenplay(
  input: RenkuConfigPathOptions & {
    document: ScreenplayCreateDocument;
    filePath?: string;
    dryRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<ScreenplayCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = validateScreenplayJsonDocument({
      value: input.document,
      kind: 'screenplayCreate',
      filePath: input.filePath,
    }).filter((issue) => issue.severity === 'warning');

    if (readScreenplayDocumentFromSession(session)) {
      throw new ProjectDataError('PROJECT_DATA204', 'Screenplay data already exists.', {
        suggestion: 'Use `renku screenplay apply` for revisions.',
      });
    }
    assertScreenplayCreateUsesExistingFacts(input.document);

    const document: ScreenplayDocument = {
      kind: 'screenplay',
      screenplay: input.document.screenplay,
      cast: listScreenplayCastMembersFromSession(session),
      locations: listScreenplayLocationsFromSession(session),
      acts: input.document.acts,
    };

    const resolved = resolveScreenplayDocumentIds({
      document,
      existing: {
        kind: 'screenplay',
        screenplay: input.document.screenplay,
        cast: document.cast,
        locations: document.locations,
        acts: [],
      },
      idGenerator: input.idGenerator,
      mode: 'create',
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
          sourceCommand: 'screenplay.create',
          summary: resolved.document.screenplay.title,
          now,
        });
      });
    }

    return {
      valid: true,
      warnings: [...warnings, ...resolved.warnings],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      changes: [{ operation: 'screenplay.create' }],
      generatedIds: resolved.generatedIds,
      resourceKeys: ['screenplay', 'screenplay:acts'],
    };
  });
}

function assertScreenplayCreateUsesExistingFacts(
  document: ScreenplayCreateDocument
): void {
  const issues: DiagnosticIssue[] = [];
  if (document.cast.length > 0) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA216',
        'screenplay create no longer creates cast members.',
        { path: ['cast'] },
        'Create cast members first with `renku cast apply`, then reference their durable ids in scenes.'
      )
    );
  }
  if (document.locations.length > 0) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA216',
        'screenplay create no longer creates locations.',
        { path: ['locations'] },
        'Create locations first with `renku location apply`, then reference their durable ids in scenes.'
      )
    );
  }
  if (issues.length > 0) {
    throw new ProjectDataError('PROJECT_DATA200', 'Screenplay create failed validation.', {
      issues,
      suggestion:
        'Create cast and location records through their department commands before creating screenplay scenes.',
    });
  }
}
