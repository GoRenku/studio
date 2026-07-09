import path from 'node:path';
import type { ProjectRelativePath } from '../../../client/index.js';
import { extensionForImageOutput, extensionForMediaSource } from '../../files/asset-paths.js';
import { imageEditSourceFile } from '../owner-lookups.js';
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

export async function resolveImageEditDestinationFile(
  input: DestinationFileInput<'image.editOutput'>
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeVersionedFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveImageEditDestinationRoot(input),
    baseName: path.parse(input.sourceProjectRelativePath).name,
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
    alwaysUseVersionSuffix: true,
  });
}

export function resolveImageEditDestinationFileSync(
  input: DestinationFileInput<'image.editOutput'>
): ProjectRelativePath {
  return allocateProjectRelativeVersionedFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveImageEditDestinationRootSync(input),
    baseName: path.parse(input.sourceProjectRelativePath).name,
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
    alwaysUseVersionSuffix: true,
  });
}

export async function resolveImageEditDestinationRoot(
  input: DestinationRootInput<'image.editOutput'>
): Promise<ProjectRelativePath> {
  return resolveImageEditDestinationRootSync(input);
}

export function resolveImageEditDestinationRootSync(
  input: DestinationRootInput<'image.editOutput'>
): ProjectRelativePath {
  const source = imageEditSourceFile(input.session, input.destination);
  return path.parse(source.projectRelativePath).dir as ProjectRelativePath;
}

export async function resolveImageEditDestinationOutputNames(
  input: DestinationOutputNamesInput<'image.editOutput'>
): Promise<string[]> {
  const source = imageEditSourceFile(input.session, {
    sourceAssetId: input.destination.sourceAssetId,
    sourceAssetFileId: input.destination.sourceAssetFileId,
  });
  const parsed = path.parse(source.projectRelativePath);
  return allocateProjectRelativeVersionedFileNames({
    projectFolder: input.projectFolder,
    parent: parsed.dir as ProjectRelativePath,
    baseName: parsed.name,
    extension: extensionForImageOutput(input.outputFormatHint ?? 'png'),
    count: input.outputCount,
    alwaysUseVersionSuffix: true,
  });
}

export async function allocateImageEditOutputNames(input: {
  session: DestinationRootInput<'image.editOutput'>['session'];
  projectFolder: string;
  sourceAssetId: string;
  sourceAssetFileId?: string;
  outputFormat: string;
  outputCount: number;
}): Promise<string[]> {
  return resolveImageEditDestinationOutputNames({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: {
      kind: 'image.editOutput',
      sourceAssetId: input.sourceAssetId,
      sourceAssetFileId: input.sourceAssetFileId,
    },
    sourceProjectRelativePath: 'tmp/source.png' as ProjectRelativePath,
    mediaKind: 'image',
    outputFormatHint: input.outputFormat,
    outputCount: input.outputCount,
    now: new Date().toISOString(),
  });
}
