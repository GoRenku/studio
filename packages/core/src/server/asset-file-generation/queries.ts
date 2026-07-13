import type { AssetFileGenerationProvenance } from '../../client/index.js';
import { readAssetFileGenerationRecord } from '../database/access/asset-file-generations.js';
import { withProjectDatabaseSession } from '../database/lifecycle/project-operation.js';
import type { ReadAssetFileGenerationProvenanceInput } from './types.js';

export async function readAssetFileGenerationProvenance(
  input: ReadAssetFileGenerationProvenanceInput,
): Promise<AssetFileGenerationProvenance | null> {
  return withProjectDatabaseSession(input, (session) => {
    return readAssetFileGenerationRecord(session, input.assetFileId);
  });
}
