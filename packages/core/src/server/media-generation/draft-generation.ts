import type {
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
} from '../../client/index.js';

export function draftMediaGenerationSpecRecord(
  spec: MediaGenerationSpec
): MediaGenerationSpecRecord {
  const now = new Date(0).toISOString();
  const prompt = 'prompt' in spec ? spec.prompt : '';
  return {
    id: `draft:${spec.purpose}:${spec.target.kind}:${targetId(spec.target)}`,
    purpose: spec.purpose,
    target: spec.target,
    modelChoice: spec.modelChoice,
    title: spec.title?.trim() || prompt.slice(0, 80) || spec.purpose,
    spec,
    createdAt: now,
    updatedAt: now,
  };
}

function targetId(target: MediaGenerationSpec['target']): string {
  if (target.kind === 'sceneDialogue') {
    return `${target.sceneId}:${target.dialogueId}`;
  }
  return target.id;
}

export async function estimatePreparedGeneration(
  prepared: PreparedMediaGeneration
) {
  const { estimateGeneration } = await import('@gorenku/studio-engines');
  return estimateGeneration(prepared.generation);
}
