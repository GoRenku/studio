import type { Asset, SceneStoryboardImagesImportReport } from '@gorenku/studio-core/client';
import type { GenerationMediaAttachmentReport } from '@gorenku/studio-core/server';

type MediaImportReport = GenerationMediaAttachmentReport | SceneStoryboardImagesImportReport;

export function renderMediaImport(report: MediaImportReport): string {
  const completion = 'asset' in report
    ? singleAttachment(report)
    : { ...report, imported: report.imported.map(assetWithoutProvenance) };
  return `Media import completed\n${JSON.stringify(completion, null, 2)}`;
}

function singleAttachment(report: GenerationMediaAttachmentReport) {
  const { generationProvenance: _provenance, ...completion } = report;
  return { ...completion, asset: assetWithoutProvenance(report.asset) };
}

function assetWithoutProvenance(asset: Asset) {
  const { generationProvenance: _provenance, ...metadata } = asset;
  return metadata;
}
