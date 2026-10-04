import type { MediaGenerationContextReport } from '@gorenku/studio-core/client';
import { renderContextFields, renderContextValue } from './values.js';

export function renderReferenceSuggestions(report: MediaGenerationContextReport): string {
  const assetFiles = new Map(report.assetFiles.map((assetFile) => [assetFile.id, assetFile]));
  return report.suggestedReferences.map((group) => {
    const { candidates, ...relationship } = group;
    const entries = candidates.map((candidate) => {
      const assetFile = assetFiles.get(candidate.assetFileId);
      const file = assetFile;
      return renderContextFields({
        ...candidate,
        title: assetFile?.title,
        path: file?.projectRelativePath,
      });
    });
    return `${renderContextFields(relationship)}\nCandidates:\n${entries.join('\n\n') || '[]'}`;
  }).join('\n\n') || '[]';
}

export function renderMedia(report: MediaGenerationContextReport): string {
  return report.assetFiles.map((assetFile) => renderContextValue(assetFile)).join('\n\n') || '[]';
}
