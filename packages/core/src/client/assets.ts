import type { ProjectRelativePath } from './project.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type AssetTarget =
  | { kind: 'project' }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'location'; locationId: string }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string };

export interface AssetLocaleContext {
  localeId?: string | null;
}

export interface UpdateAssetReferenceInput {
  projectName: string;
  target: AssetTarget;
  assetId: string;
  title?: string | null;
  oneLineSummary?: string | null;
  referenceName: string;
  purpose?: string | null;
}

export interface AssetReferenceUpdateReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    name: string;
    id: string;
    projectFolder: string;
  };
  asset: Asset;
  resourceKeys: string[];
}

export interface DisplayAssetMutationReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    name: string;
    id: string;
    projectFolder: string;
  };
  asset: Asset | null;
  resourceKeys: string[];
}

export interface AssetReference {
  assetId: string;
  relationshipId: string;
  target: AssetTarget;
}

export type Asset = AssetReference & {
  localeId: string | null;
  type: string;
  availability: AssetAvailability;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  role: string;
  referenceName: string | null;
  purpose: string | null;
  sortOrder: number;
  files: AssetFile[];
  createdAt: string;
  updatedAt: string;
};

export type AssetAvailability = 'ready';

export interface AssetFile {
  id: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: string;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}
