import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  recordAssetFileGenerationProvenance,
  recordAssetFileGenerationProvenanceInSession,
} from './commands.js';

export async function recordImportedAssetFileGenerationProvenance(input: {
  projectName?: string;
  homeDir?: string;
  assetFileId: string;
  receipt?: unknown;
}): Promise<void> {
  const mediaGenerationRunId = generationRunIdFromReceipt(input.receipt);
  if (!mediaGenerationRunId) {
    return;
  }
  await recordAssetFileGenerationProvenance({
    projectName: input.projectName,
    homeDir: input.homeDir,
    assetFileId: input.assetFileId,
    mediaGenerationRunId,
  });
}

export function recordImportedAssetFileGenerationProvenanceInSession(input: {
  session: DatabaseSession;
  assetFileId: string;
  receipt?: unknown;
}): void {
  const mediaGenerationRunId = generationRunIdFromReceipt(input.receipt);
  if (!mediaGenerationRunId) {
    return;
  }
  recordAssetFileGenerationProvenanceInSession(input.session, {
    assetFileId: input.assetFileId,
    mediaGenerationRunId,
  });
}

export function generationRunIdFromReceipt(receipt: unknown): string | null {
  if (!receipt || typeof receipt !== 'object') {
    return null;
  }
  if ('run' in receipt) {
    const run = (receipt as { run?: { id?: unknown } }).run;
    return typeof run?.id === 'string' ? run.id : null;
  }
  if ('id' in receipt) {
    const id = (receipt as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}
