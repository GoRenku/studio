import type {
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
} from '../../client/index.js';

export function draftMediaGenerationSpecRecord(
  spec: MediaGenerationSpec
): MediaGenerationSpecRecord {
  const now = new Date(0).toISOString();
  return {
    id: `draft:${spec.purpose}:${spec.target.kind}:${spec.target.id}`,
    purpose: spec.purpose,
    target: spec.target,
    modelChoice: spec.modelChoice,
    title: spec.title?.trim() || spec.prompt.slice(0, 80) || spec.purpose,
    spec,
    createdAt: now,
    updatedAt: now,
  };
}

export async function estimatePreparedGeneration(
  prepared: PreparedMediaGeneration
) {
  const { estimateGeneration } = await import('@gorenku/studio-engines');
  return estimateGeneration(prepared.generation);
}
