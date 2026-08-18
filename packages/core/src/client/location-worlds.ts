import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from './assets.js';
import type { Location } from './locations.js';
import type { ProjectRelativePath } from './project/index.js';

export interface LocationWorldGenerationDocument {
  kind: 'locationWorldGeneration';
  version: 1;
  locationId: string;
  prompt?: string;
  source:
    | {
        kind: 'panorama';
        projectRelativePath: ProjectRelativePath;
      }
    | {
        kind: 'multiImage';
        images: Array<{
          projectRelativePath: ProjectRelativePath;
        }>;
      };
}

export interface LocationWorldGenerationReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    projectName: string;
    id: string;
    projectFolder: string;
  };
  location: Location;
  asset: Asset;
  selectedAssetId: string;
  provider: {
    name: 'world-labs';
    model: 'marble-1.1';
    operationId: string;
    worldId: string;
  };
  resourceKeys: string[];
}

export interface LocationWorldResource {
  location: Location;
  selectedWorld: Asset | null;
}
