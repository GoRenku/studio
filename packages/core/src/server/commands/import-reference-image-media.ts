import type {
  AssetTarget,
  ReferenceImageMediaImportReport,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export interface ImportReferenceImageMediaInput extends RenkuConfigPathOptions {
  projectName?: string;
  target: AssetTarget;
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  referenceName?: string;
  referencePurpose?: string;
}

export async function importReferenceImageMedia(
  _input: ImportReferenceImageMediaInput
): Promise<ReferenceImageMediaImportReport> {
  throw new ProjectDataError(
    'PROJECT_DATA447',
    'Generic reference.image imports are not supported for one-off generation references.',
    {
      suggestion:
        'Pass the project-relative file path through the generation spec referenceFiles field, or import the file through the domain command that owns it.',
    }
  );
}
