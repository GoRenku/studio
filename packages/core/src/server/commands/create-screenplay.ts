import type {
  ScreenplayCommandReport,
  ScreenplayCreateDocument,
  ScreenplayDocument,
} from '../../client/screenplay.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { validateScreenplayJsonDocument } from '../screenplay-json/validator.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { replaceScreenplayDocument, resolveScreenplayDocumentIds } from '../database/access/screenplay-persistence.js';

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

    const document: ScreenplayDocument = {
      kind: 'screenplay',
      screenplay: input.document.screenplay,
      cast: input.document.cast,
      locations: input.document.locations,
      acts: input.document.acts,
    };

    const resolved = resolveScreenplayDocumentIds({
      document,
      idGenerator: input.idGenerator,
      mode: 'create',
    });
    if (!input.dryRun) {
      replaceScreenplayDocument(session, resolved.document);
    }

    return {
      valid: true,
      warnings: [...warnings, ...resolved.warnings],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      changes: [{ operation: 'screenplay.create' }],
      generatedIds: resolved.generatedIds,
      resourceKeys: ['screenplay', 'screenplay:cast', 'screenplay:locations', 'screenplay:acts'],
    };
  });
}
