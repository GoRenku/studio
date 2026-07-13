import type { ProjectRelativePath } from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import type { ProjectAssetFileDestination, ProjectMediaKind } from '../types.js';

export type DestinationKind = ProjectAssetFileDestination['kind'];

export type DestinationForKind<K extends DestinationKind> = Extract<
  ProjectAssetFileDestination,
  { kind: K }
>;

export interface DestinationFileInput<K extends DestinationKind> {
  session: DatabaseSession;
  projectFolder: string;
  destination: DestinationForKind<K>;
  sourceProjectRelativePath: ProjectRelativePath;
  mediaKind: ProjectMediaKind;
  now: string;
  outputFormatHint?: string;
}

export interface DestinationRootInput<K extends DestinationKind> {
  session: DatabaseSession;
  projectFolder: string;
  destination: DestinationForKind<K>;
  sourceProjectRelativePath?: ProjectRelativePath;
  now: string;
}

export interface DestinationOutputNamesInput<K extends DestinationKind> {
  session: DatabaseSession;
  projectFolder: string;
  destination: DestinationForKind<K>;
  sourceProjectRelativePath: ProjectRelativePath;
  mediaKind: ProjectMediaKind;
  outputCount: number;
  now: string;
  outputFormatHint?: string;
}

export interface DestinationResolver<K extends DestinationKind> {
  resolveFile(input: DestinationFileInput<K>): Promise<ProjectRelativePath>;
  resolveFileSync(input: DestinationFileInput<K>): ProjectRelativePath;
  resolveRoot(input: DestinationRootInput<K>): Promise<ProjectRelativePath>;
  resolveRootSync(input: DestinationRootInput<K>): ProjectRelativePath;
  resolveOutputNames(input: DestinationOutputNamesInput<K>): Promise<string[]>;
}

export type DestinationResolverRegistry = {
  [K in DestinationKind]: DestinationResolver<K>;
};
