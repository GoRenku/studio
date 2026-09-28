import { fdxUpdateReviewSchema } from '../../../client/screenplay/fdx-updates.js';
import Ajv2020 from 'ajv/dist/2020.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ImportFdxScreenplayReport } from './contracts.js';
import {
  importFdxScreenplayReportSchema,
  screenplayImportCandidatesSchema,
  screenplayImportLogEntrySchema,
} from './schemas.js';

let cachedAjv: Ajv2020 | undefined;

function getAjv(): Ajv2020 {
  if (cachedAjv) {
    return cachedAjv;
  }
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(screenplayImportLogEntrySchema);
  ajv.addSchema(screenplayImportCandidatesSchema);
  cachedAjv = ajv;
  return ajv;
}

function getReportValidator() {
  return getAjv().compile(importFdxScreenplayReportSchema);
}

export function assertValidFdxImportReport(
  value: unknown,
): asserts value is ImportFdxScreenplayReport {
  if (!getReportValidator()(value)) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_IMPORT_INVALID',
      `FDX import report failed validation: ${getAjv().errorsText(getReportValidator().errors)}.`,
    );
  }
}

function getUpdateReviewValidator() {
  return getAjv().compile(fdxUpdateReviewSchema);
}

export function assertValidFdxUpdateReview(value: unknown): void {
  if (!getUpdateReviewValidator()(value)) {
    throw new ProjectDataError('SCREENPLAY_FDX_IMPORT_INVALID',
      `FDX update review failed validation: ${getAjv().errorsText(getUpdateReviewValidator().errors)}.`);
  }
}
