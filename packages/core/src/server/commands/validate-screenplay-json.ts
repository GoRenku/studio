import type {
  ScreenplayCommandReport,
  ScreenplayCreateDocument,
  ScreenplayDocument,
  ScreenplayOperationDocument,
} from '../../client/screenplay.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { resolveScreenplayDocumentIds } from '../database/access/screenplay-persistence.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { validateScreenplayJsonDocument } from '../screenplay-json/validator.js';
import { buildScreenplayDraftForOperations } from './apply-screenplay-operations.js';

export async function validateScreenplayJson(
  input: RenkuConfigPathOptions & {
    document?: ScreenplayDocument | ScreenplayCreateDocument | ScreenplayOperationDocument;
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
      warnings.push(...resolveScreenplayDocumentIds({ document: input.document }).warnings);
    } else if (input.document?.kind === 'screenplayCreate') {
      warnings.push(
        ...resolveScreenplayDocumentIds({
          document: {
            kind: 'screenplay',
            screenplay: input.document.screenplay,
            cast: input.document.cast,
            locations: input.document.locations,
            acts: input.document.acts,
          },
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
      warnings.push(...resolveScreenplayDocumentIds({ document: draft }).warnings);
    } else if (!input.document) {
      const current = readScreenplayDocumentFromSession(session);
      if (!current) {
        throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
          suggestion: 'Use `renku screenplay create` first.',
        });
      }
      warnings.push(...resolveScreenplayDocumentIds({ document: current }).warnings);
    }

    return {
      valid: true,
      warnings,
      project: { name: currentProject.projectName, id: currentProject.projectId },
      changes: [],
      generatedIds: [],
      resourceKeys: ['screenplay'],
    };
  });
}
