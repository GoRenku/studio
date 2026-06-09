import type {
  ScreenplayCommandReport,
  ScreenplayCreateDocument,
  ScreenplayDocument,
  ScreenplayOperationDocument,
  ScreenplaySceneRevisionDocument,
} from '../../client/screenplay.js';
import {
  listScreenplayCastMembersFromSession,
  listScreenplayLocationsFromSession,
  readScreenplayDocumentFromSession,
} from '../database/access/screenplay-resource.js';
import { resolveScreenplayDocumentIds } from '../database/access/screenplay-persistence.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { validateScreenplayJsonDocument } from '../screenplay-json/validator.js';
import { studioScreenplayResourceKey } from '../studio-coordination/resource-keys.js';
import { buildScreenplayDraftForOperations } from './apply-screenplay-operations.js';

export async function validateScreenplayJson(
  input: RenkuConfigPathOptions & {
    document?:
      | ScreenplayDocument
      | ScreenplayCreateDocument
      | ScreenplayOperationDocument
      | ScreenplaySceneRevisionDocument;
    filePath?: string;
  } = {}
): Promise<ScreenplayCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = input.document
      ? validateScreenplayJsonDocument({
          value: input.document,
          filePath: input.filePath,
        }).filter((issue) => issue.severity === 'warning')
      : [];

    if (input.document?.kind === 'screenplay') {
      warnings.push(...resolveScreenplayDocumentIds({ document: input.document, mode: 'canonical' }).warnings);
    } else if (input.document?.kind === 'screenplayCreate') {
      if (input.document.cast.length > 0 || input.document.locations.length > 0) {
        throw new ProjectDataError('PROJECT_DATA200', 'Screenplay create failed validation.', {
          suggestion:
            'Create cast and location records through their department commands before creating screenplay scenes.',
        });
      }
      const cast = listScreenplayCastMembersFromSession(session);
      const locations = listScreenplayLocationsFromSession(session);
      warnings.push(
        ...resolveScreenplayDocumentIds({
          document: {
            kind: 'screenplay',
            screenplay: input.document.screenplay,
            cast,
            locations,
            acts: input.document.acts,
          },
          existing: {
            kind: 'screenplay',
            screenplay: input.document.screenplay,
            cast,
            locations,
            acts: [],
          },
          mode: 'create',
        }).warnings
      );
    } else if (input.document?.kind === 'screenplayOperations') {
      const base = readScreenplayDocumentFromSession(session);
      if (!base) {
        throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
          suggestion: 'Use `renku screenplay create` before validating revisions.',
        });
      }
      const { draft } = buildScreenplayDraftForOperations(base, input.document);
      warnings.push(...resolveScreenplayDocumentIds({ document: draft, existing: base, mode: 'mutation' }).warnings);
    } else if (!input.document) {
      const current = readScreenplayDocumentFromSession(session);
      if (!current) {
        throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
          suggestion: 'Use `renku screenplay create` first.',
        });
      }
      warnings.push(...resolveScreenplayDocumentIds({ document: current, mode: 'canonical' }).warnings);
    }

    return {
      valid: true,
      warnings,
      project: { name: currentProject.projectName, id: currentProject.projectId },
      changes: [],
      generatedIds: [],
      resourceKeys: [studioScreenplayResourceKey()],
    };
  });
}
