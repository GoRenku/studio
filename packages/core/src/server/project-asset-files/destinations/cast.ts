import type { ProjectRelativePath } from '../../../client/index.js';
import { CAST_ROOT, extensionForMediaSource } from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireCastMember } from '../owner-lookups.js';
import {
  allocateProjectRelativeVersionedFileNames,
  allocateProjectRelativeVersionedFilePath,
  allocateProjectRelativeVersionedFilePathSync,
} from '../path-allocation.js';
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
  return allocateProjectRelativeVersionedFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveCastDestinationRoot(input),
    ...castFileName(input),
  });
}

export function resolveCastDestinationFileSync(
  input: DestinationFileInput<CastDestinationKind>
): ProjectRelativePath {
  return allocateProjectRelativeVersionedFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveCastDestinationRootSync(input),
    ...castFileName(input),
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
  const castMember = requireCastMember(
    input.session,
    input.destination.castMemberId
  );
  const folder =
    input.destination.kind === 'cast.characterSheet'
      ? 'character-sheets'
      : input.destination.kind === 'cast.profile'
        ? 'profiles'
        : 'voice-samples';
  return joinProjectRelativePath(CAST_ROOT, castMember.handle, folder);
}

export async function resolveCastDestinationOutputNames(
  input: DestinationOutputNamesInput<CastDestinationKind>
): Promise<string[]> {
  return allocateProjectRelativeVersionedFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveCastDestinationRoot(input),
    ...castFileName(input),
    count: input.outputCount,
  });
}

function castFileName(
  input: DestinationFileInput<CastDestinationKind> | DestinationOutputNamesInput<CastDestinationKind>
): { baseName: string; extension: string } {
  if (input.destination.kind === 'cast.characterSheet') {
    return {
      baseName: input.destination.titleHint ?? 'character-sheet',
      extension: extensionForMediaSource(input.sourceProjectRelativePath),
    };
  }
  if (input.destination.kind === 'cast.profile') {
    return {
      baseName: input.destination.titleHint ?? 'profile',
      extension: extensionForMediaSource(input.sourceProjectRelativePath),
    };
  }
  return {
    baseName: input.destination.referenceName,
    extension:
      input.outputFormatHint ??
      extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
