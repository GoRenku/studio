import type { AssetFileGenerationProvenance } from '../../client/index.js';
import { readAssetFileGenerationRecord } from '../database/access/asset-file-generations.js';
import { withMediaGenerationProjectSession } from '../media-generation/lifecycle/project-session.js';
import type { ReadAssetFileGenerationProvenanceInput } from './types.js';

export async function readAssetFileGenerationProvenance(
  input: ReadAssetFileGenerationProvenanceInput,
): Promise<AssetFileGenerationProvenance | null> {
  return withMediaGenerationProjectSession(input, ({ session }) => {
    return readAssetFileGenerationRecord(session, input.assetFileId);
  });
}
