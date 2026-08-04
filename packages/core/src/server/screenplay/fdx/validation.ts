import Ajv2020 from 'ajv/dist/2020.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ImportFdxScreenplayReport } from './contracts.js';
import {
  importFdxScreenplayReportSchema,
  screenplayImportCandidatesSchema,
  screenplayImportLogEntrySchema,
} from './schemas.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(screenplayImportLogEntrySchema);
ajv.addSchema(screenplayImportCandidatesSchema);
const reportValidator = ajv.compile(importFdxScreenplayReportSchema);

export function assertValidFdxImportReport(
  value: unknown,
): asserts value is ImportFdxScreenplayReport {
  if (!reportValidator(value)) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_IMPORT_INVALID',
      `FDX import report failed validation: ${ajv.errorsText(reportValidator.errors)}.`,
    );
  }
}
