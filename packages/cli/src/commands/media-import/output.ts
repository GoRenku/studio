import type { AssetFile, SceneStoryboardImagesImportReport } from '@gorenku/studio-core/client';
import type { GenerationMediaAttachmentReport } from '@gorenku/studio-core/server';

type MediaImportReport = GenerationMediaAttachmentReport | SceneStoryboardImagesImportReport;

export function renderMediaImport(report: MediaImportReport): string {
  const completion = 'assetFile' in report
    ? singleAttachment(report)
    : { ...report, imported: report.imported.map(assetFileWithoutProvenance) };
  return `Media import completed\n${JSON.stringify(completion, null, 2)}`;
}

function singleAttachment(report: GenerationMediaAttachmentReport) {
  const { generationProvenance: _provenance, ...completion } = report;
  return { ...completion, assetFile: assetFileWithoutProvenance(report.assetFile) };
}

function assetFileWithoutProvenance(assetFile: AssetFile) {
  const { generationProvenance: _provenance, ...metadata } = assetFile;
  return metadata;
}
