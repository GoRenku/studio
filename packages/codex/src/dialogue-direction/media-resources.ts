import fs from 'node:fs/promises';
import { readMediaGenerationReferenceProjectFile } from '@gorenku/studio-core/server';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { directionError } from './diagnostics.js';
import type { DialogueDirectionState } from './session-state.js';

/** Serves `renku-direction://{sessionId}/media/{mediaId}` as a base64 blob of the declared project file. */
export async function readDirectionMedia(state: DialogueDirectionState, uri: string, homeDir?: string): Promise<ReadResourceResult> {
  const parsed = new URL(uri);
  const [segment, mediaId, ...remaining] = parsed.pathname.slice(1).split('/');
  if (parsed.protocol !== 'renku-direction:' || segment !== 'media' || !mediaId || remaining.length > 0 || parsed.search || parsed.hash) {
    throw mediaNotFound();
  }
  const record = state.record(parsed.hostname);
  const projectRelativePath = record.media.path(mediaId);
  if (!projectRelativePath) throw mediaNotFound();
  const file = await readMediaGenerationReferenceProjectFile({
    projectName: record.binding.projectRef.name,
    projectRelativePath,
    expectedProjectId: record.binding.projectRef.id,
    homeDir,
  });
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(file.absolutePath);
  } catch {
    throw mediaNotFound();
  }
  return { contents: [{ uri, mimeType: file.mimeType, blob: bytes.toString('base64') }] };
}

function mediaNotFound() {
  return directionError('CODEX_DIALOGUE_DIRECTION_NOT_FOUND', 'This dialogue direction media is not available.');
}
