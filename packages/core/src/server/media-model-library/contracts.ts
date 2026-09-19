import type { RenkuConfigPathOptions } from '../config/index.js';

export interface MediaModelRoute {
  provider: string;
  apiId: string;
  name: string;
}

export interface PersonalMediaModelLibrary {
  formatVersion: 1;
  entries: MediaModelRoute[];
}

export interface MediaModelDiscoveryRoute extends MediaModelRoute {
  source: 'bundled' | 'personal';
  hasBundledEntry: boolean;
}

export interface MediaModelLibraryQuery extends RenkuConfigPathOptions {
  bundledRouteIndexPaths?: readonly string[];
  provider?: string;
}

export interface MediaModelIdentity {
  provider: string;
  apiId: string;
}

export interface PersonalMediaModelMutation extends RenkuConfigPathOptions {
  expectedRevision: string | null;
}
