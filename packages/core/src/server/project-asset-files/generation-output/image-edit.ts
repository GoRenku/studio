import { IMAGE_EDIT_GENERATION_PURPOSE } from '../../../client/index.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import { imageEditSourceFile } from '../owner-lookups.js';
import type { GenerationOutputAllocation, GenerationOutputResolverInput } from './types.js';
import { specObject, targetId } from './types.js';

export async function resolveImageEditGenerationOutput(
  input: GenerationOutputResolverInput<typeof IMAGE_EDIT_GENERATION_PURPOSE>
): Promise<GenerationOutputAllocation> {
  const spec = specObject(input.specRecord);
  const sourceAssetId = targetId(spec);
  const sourceAssetFileId =
    typeof spec.sourceAssetFileId === 'string'
      ? spec.sourceAssetFileId
      : undefined;
  const sourceFile = imageEditSourceFile(input.session, {
    sourceAssetId,
    sourceAssetFileId,
  });
  const parameterValues = spec.parameterValues as Record<string, unknown> | undefined;
  return {
    kind: 'durableAsset',
    destination: {
      kind: 'image.editOutput',
      sourceAssetId,
      sourceAssetFileId,
    },
    sourceProjectRelativePath: normalizeProjectRelativePath(
      sourceFile.projectRelativePath
    ),
    mediaKind: 'image',
    outputFormatHint: String(parameterValues?.output_format ?? 'png'),
  };
}
