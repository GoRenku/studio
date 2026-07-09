import {
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type { GenerationOutputAllocation, GenerationOutputResolverInput } from './types.js';
import { sourceProjectRelativePathForMediaKind, specObject, targetId } from './types.js';

type LocationPurpose =
  | typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE
  | typeof LOCATION_HERO_GENERATION_PURPOSE;

export async function resolveLocationGenerationOutput(
  input: GenerationOutputResolverInput<LocationPurpose>
): Promise<GenerationOutputAllocation> {
  const spec = specObject(input.specRecord);
  return {
    kind: 'durableAsset',
    destination:
      input.specRecord.purpose === LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE
        ? {
            kind: 'location.environmentSheet',
            locationId: targetId(spec),
          }
        : { kind: 'location.hero', locationId: targetId(spec) },
    sourceProjectRelativePath: sourceProjectRelativePathForMediaKind('image'),
    mediaKind: 'image',
  };
}
