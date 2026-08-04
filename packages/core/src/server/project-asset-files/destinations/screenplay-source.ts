import type { ProjectRelativePath } from '../../../client/index.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type ScreenplaySourceKind = 'screenplay.source';

export async function resolveScreenplaySourceDestinationFile(
  input: DestinationFileInput<ScreenplaySourceKind>,
): Promise<ProjectRelativePath> {
  return resolveScreenplaySourceDestinationFileSync(input);
}

export function resolveScreenplaySourceDestinationFileSync(
  input: DestinationFileInput<ScreenplaySourceKind>,
): ProjectRelativePath {
  return joinProjectRelativePath(
    resolveScreenplaySourceDestinationRootSync(input),
    `${input.destination.sha256}.fdx`,
  );
}

export async function resolveScreenplaySourceDestinationRoot(
  input: DestinationRootInput<ScreenplaySourceKind>,
): Promise<ProjectRelativePath> {
  return resolveScreenplaySourceDestinationRootSync(input);
}

export function resolveScreenplaySourceDestinationRootSync(
  _input: DestinationRootInput<ScreenplaySourceKind>,
): ProjectRelativePath {
  return joinProjectRelativePath('screenplay', 'sources');
}

export async function resolveScreenplaySourceDestinationOutputNames(
  input: DestinationOutputNamesInput<ScreenplaySourceKind>,
): Promise<string[]> {
  if (input.outputCount !== 1) {
    return [];
  }
  return [`${input.destination.sha256}.fdx`];
}
