import type { MediaGenerationContextReport } from '@gorenku/studio-core/client';
import { renderContextFields, renderContextValue } from './values.js';

export function renderReferenceSuggestions(report: MediaGenerationContextReport): string {
  const assets = new Map(report.assets.map((asset) => [asset.id, asset]));
  return report.suggestedReferences.map((group) => {
    const { candidates, ...relationship } = group;
    const entries = candidates.map((candidate) => {
      const asset = assets.get(candidate.assetId);
      const file = asset?.files.find((entry) => entry.id === candidate.assetFileId);
      return renderContextFields({
        ...candidate,
        title: asset?.title,
        path: file?.projectRelativePath,
      });
    });
    return `${renderContextFields(relationship)}\nCandidates:\n${entries.join('\n\n') || '[]'}`;
  }).join('\n\n') || '[]';
}

export function renderMedia(report: MediaGenerationContextReport): string {
  return report.assets.map((asset) => renderContextValue(asset)).join('\n\n') || '[]';
}
