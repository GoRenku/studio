import type { ProjectRelativePath } from '../../../client/index.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireCastMember } from '../owner-lookups.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import {
  fixedFileStem,
  requiredSemanticFileStem,
} from '../naming/safe-segments.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type CastDestinationKind =
  | 'cast.characterSheet'
  | 'cast.profile'
  | 'cast.voiceSample';

export async function resolveCastDestinationFile(
  input: DestinationFileInput<CastDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveCastDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: castGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveCastDestinationFileSync(
  input: DestinationFileInput<CastDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveCastDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: castGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveCastDestinationRoot(
  input: DestinationRootInput<CastDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveCastDestinationRootSync(input);
}

export function resolveCastDestinationRootSync(
  input: DestinationRootInput<CastDestinationKind>
): ProjectRelativePath {
  const castMember = requireCastMember(input.session, input.destination.castMemberId);
  return joinProjectRelativePath('cast', castMember.handle);
}

export async function resolveCastDestinationOutputNames(
  input: DestinationOutputNamesInput<CastDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveCastDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: castGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function castGeneratedFileStem(
  input:
    | DestinationFileInput<CastDestinationKind>
    | DestinationOutputNamesInput<CastDestinationKind>
): string {
  if (input.namingMode.kind === 'external') {
    return 'external';
  }
  if (input.destination.kind === 'cast.characterSheet') {
    return requiredSemanticFileStem(input.destination.semanticName, 'sheet');
  }
  if (input.destination.kind === 'cast.profile') {
    return fixedFileStem('profile');
  }
  return requiredSemanticFileStem(input.destination.referenceName);
}
