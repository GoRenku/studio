import type { ProjectRelativePath } from '../../../client/index.js';
import { requireLookbookRecordById } from '../../database/access/lookbook.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import { requiredSemanticFileStem } from '../naming/safe-segments.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type LookbookDestinationKind =
  | 'visualLanguage.lookbookImage'
  | 'visualLanguage.lookbookSheet';

export async function resolveLookbookDestinationFile(
  input: DestinationFileInput<LookbookDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveLookbookDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: lookbookGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveLookbookDestinationFileSync(
  input: DestinationFileInput<LookbookDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveLookbookDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: lookbookGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveLookbookDestinationRoot(
  input: DestinationRootInput<LookbookDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveLookbookDestinationRootSync(input);
}

export function resolveLookbookDestinationRootSync(
  input: DestinationRootInput<LookbookDestinationKind>
): ProjectRelativePath {
  const lookbook = requireLookbookRecordById(input.session, input.destination.lookbookId);
  return joinProjectRelativePath('visual-language', 'lookbooks', lookbook.kind);
}

export async function resolveLookbookDestinationOutputNames(
  input: DestinationOutputNamesInput<LookbookDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveLookbookDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: lookbookGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function lookbookGeneratedFileStem(
  input:
    | DestinationFileInput<LookbookDestinationKind>
    | DestinationOutputNamesInput<LookbookDestinationKind>
): string {
  if (input.namingMode.kind === 'external') {
    return 'external';
  }
  return input.destination.kind === 'visualLanguage.lookbookSheet'
    ? requiredSemanticFileStem(input.destination.semanticName, 'sheet')
    : requiredSemanticFileStem(input.destination.semanticName);
}
