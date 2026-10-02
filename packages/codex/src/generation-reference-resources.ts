import fs from 'node:fs/promises';
import { readMediaGenerationReferenceProjectFile } from '@gorenku/studio-core/server';
import { GenerationReviewState } from './generation-review-state.js';
import { createReferenceThumbnail } from './reference-thumbnails.js';
import { reviewError } from './diagnostics.js';

export async function readGenerationReference(state: GenerationReviewState, uri: string, homeDir?: string) {
  const parsed = new URL(uri);
  const [referenceId, variant, ...remaining] = parsed.pathname.slice(1).split('/');
  if (parsed.protocol !== 'renku-reference:' || !referenceId || parsed.search || parsed.hash || remaining.length > 0 || (variant !== undefined && variant !== 'thumbnail')) {
    throw reviewError('CODEX_REFERENCE_UNAVAILABLE', 'This reference resource is not available.');
  }
  const binding = state.binding(parsed.hostname);
  const source = binding.sources.find((source) => source.references.has(referenceId));
  const reference = state.read(parsed.hostname).requests.flatMap((request) => request.preview.references).find((reference) => reference.referenceId === referenceId);
  if (!source || !reference || (variant === 'thumbnail' && reference.kind !== 'image')) throw reviewError('CODEX_REFERENCE_UNAVAILABLE', 'The reference is not declared by this review.');
  const file = await readMediaGenerationReferenceProjectFile({ projectName: binding.project, projectRelativePath: source.references.get(referenceId)!, expectedProjectId: binding.projectId, homeDir });
  let bytes: Buffer;
  try {
    bytes = variant === 'thumbnail' ? await createReferenceThumbnail(file.absolutePath) : await fs.readFile(file.absolutePath);
  } catch {
    throw reviewError('CODEX_REFERENCE_UNAVAILABLE', 'The declared reference could not be loaded.');
  }
  return { contents: [{ uri, mimeType: variant === 'thumbnail' ? 'image/webp' : file.mimeType, blob: bytes.toString('base64') }] };
}
