import type { GenerationSpec, ImageRevisionSourceRequest } from '../../client/index.js';
import { readAssetFileRecordByIdIncludingDiscarded } from '../database/access/asset-files.js';
import { readAssetRecord } from '../database/access/assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export function projectImageRevisionSourceRequest(input: {
  spec: GenerationSpec | null;
  session: DatabaseSession;
}): ImageRevisionSourceRequest | null {
  if (!input.spec) {
    return null;
  }
  return {
    ...(input.spec.model ? { model: structuredClone(input.spec.model) } : {}),
    values: structuredClone(input.spec.values),
    referenceLabels: referenceLabels(input.spec, input.session),
  };
}

function referenceLabels(spec: GenerationSpec, session: DatabaseSession): string[] {
  const labels: string[] = [];
  for (const selection of spec.references) {
    if (selection.reference.kind !== 'asset-file') {
      continue;
    }
    const file = readAssetFileRecordByIdIncludingDiscarded(session, selection.reference.assetFileId);
    if (!file || file.discardedAt || file.assetId !== selection.reference.assetId) {
      continue;
    }
    const asset = readAssetRecord(session, selection.reference.assetId);
    const label = asset && !asset.discardedAt ? asset.title.trim() : '';
    if (label && !labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}
