import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type {
  DefaultModelListResource,
  DefaultModelListSyncReport,
} from '../../client/default-models.js';
import type { RenkuConfigPathOptions } from '../config/paths.js';
import {
  DEFAULT_MODEL_LIST_FORMAT_VERSION,
  parseDefaultModelList,
} from './document.js';
import {
  readStoredDefaultModelList,
  resolveDefaultModelListPath,
  writeStoredDefaultModelList,
} from './store.js';

/**
 * Copies the Skill's Default Model List into the Renku state directory so
 * Studio Settings and the Route Chooser can list models without locating the
 * installed Skills. Unchanged content is a no-op.
 */
export async function syncDefaultModelList(
  input: RenkuConfigPathOptions & { file: string; now?: () => Date }
): Promise<DefaultModelListSyncReport> {
  const contents = await readSourceFile(input.file);
  const lanes = parseDefaultModelList(contents, input.file);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  const stored = await readStoredDefaultModelList(input);
  if (stored?.sha256 === sha256) {
    return { changed: false, sha256, path: resolveDefaultModelListPath(input) };
  }
  const storePath = await writeStoredDefaultModelList({
    formatVersion: DEFAULT_MODEL_LIST_FORMAT_VERSION,
    syncedAt: (input.now ?? (() => new Date()))().toISOString(),
    sha256,
    lanes,
  }, input);
  return { changed: true, sha256, path: storePath };
}

export async function readDefaultModelList(
  options: RenkuConfigPathOptions = {}
): Promise<DefaultModelListResource> {
  const stored = await readStoredDefaultModelList(options);
  return stored
    ? { state: 'synced', syncedAt: stored.syncedAt, lanes: stored.lanes }
    : { state: 'notSynced' };
}

async function readSourceFile(file: string): Promise<string> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new StructuredError({
      code: 'DEFAULT_MODELS003',
      message: `Cannot read the Default Model List at ${file}: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Pass the default-models.json file from the installed Renku media-producer skill.',
    });
  }
}
