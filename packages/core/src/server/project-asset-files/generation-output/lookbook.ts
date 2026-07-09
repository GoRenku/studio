import {
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type { GenerationOutputAllocation, GenerationOutputResolverInput } from './types.js';
import { sourceProjectRelativePathForMediaKind } from './types.js';

type LookbookPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof LOOKBOOK_SHEET_GENERATION_PURPOSE;

export async function resolveLookbookGenerationOutput(
  input: GenerationOutputResolverInput<LookbookPurpose>
): Promise<GenerationOutputAllocation> {
  return {
    kind: 'durableAsset',
    destination:
      input.specRecord.purpose === LOOKBOOK_IMAGE_GENERATION_PURPOSE
        ? { kind: 'visualLanguage.lookbookImage' }
        : { kind: 'visualLanguage.lookbookSheet' },
    sourceProjectRelativePath: sourceProjectRelativePathForMediaKind('image'),
    mediaKind: 'image',
  };
}
