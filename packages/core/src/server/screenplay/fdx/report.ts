import {
  studioScreenplayResourceKey,
  studioScreenplayStructureResourceKey,
} from '../../studio-coordination/resource-keys.js';
import type { MappedFdxScreenplay } from './mapping/screenplay.js';
import type { FdxSource } from './source.js';
import {
  FDX_IMPORTER_VERSION,
  type ImportFdxScreenplayReport,
  type ScreenplayImport,
} from './contracts.js';
import { assertValidFdxImportReport } from './validation.js';

export function createFdxImportReport(input: {
  status: ImportFdxScreenplayReport['status'];
  project: { id: string; projectName: string };
  source: FdxSource;
  screenplayImport: ScreenplayImport;
  mapped: MappedFdxScreenplay;
  resourceKeys: string[];
}): ImportFdxScreenplayReport {
  const report: ImportFdxScreenplayReport = {
    valid: true,
    warnings: [],
    status: input.status,
    project: { id: input.project.id, projectName: input.project.projectName },
    screenplayImport: {
      id: input.screenplayImport.id,
      sourceAssetId: input.screenplayImport.sourceAssetId,
      sourceAssetFileId: input.screenplayImport.sourceAssetFileId,
      importerVersion: FDX_IMPORTER_VERSION,
      importedAt: input.screenplayImport.importedAt,
      sourceFilename: input.source.filename,
      sha256: input.source.sha256,
    },
    counts: input.mapped.counts,
    candidates: input.mapped.candidates,
    resourceKeys: input.resourceKeys,
  };
  assertValidFdxImportReport(report);
  return report;
}

export function screenplayFdxResourceKeys(): string[] {
  return [studioScreenplayResourceKey(), studioScreenplayStructureResourceKey()];
}
