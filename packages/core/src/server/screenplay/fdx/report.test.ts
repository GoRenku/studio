import { describe, expect, it } from 'vitest';
import { assertValidFdxImportReport } from './validation.js';

describe('FDX import report contract', () => {
  it('accepts only the direct current-state outcome shape', () => {
    const report = validReport();
    for (const status of ['imported', 'refreshed', 'unchanged']) {
      expect(() => assertValidFdxImportReport({ ...report, status })).not.toThrow();
    }
    expect(() => assertValidFdxImportReport({ ...report, status: 'pending' }))
      .toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_IMPORT_INVALID' }));
    expect(() => assertValidFdxImportReport({ ...report, extraField: true }))
      .toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_IMPORT_INVALID' }));
    expect(() => assertValidFdxImportReport({
      ...report,
      counts: { ...report.counts, sections: 0 },
    })).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_IMPORT_INVALID' }));
  });
});

function validReport() {
  return {
    valid: true,
    warnings: [],
    status: 'imported',
    project: { id: 'project_1', projectName: 'movie' },
    screenplayImport: {
      id: 'screenplay_import_1',
      sourceAssetId: 'asset_1',
      sourceAssetFileId: 'asset_file_1',
      importerVersion: 1,
      importedAt: '2026-08-15T00:00:00.000Z',
      sourceFilename: 'movie.fdx',
      sha256: 'a'.repeat(64),
    },
    counts: {
      scenes: 1,
      blocks: 1,
      dialogueTurns: 0,
      productionSceneNumbers: 1,
    },
    candidates: {
      characterCues: [],
      sceneHeadings: [],
      taggedSubjects: [],
    },
    resourceKeys: [],
  };
}
