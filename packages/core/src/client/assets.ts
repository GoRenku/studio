import type { ProjectRelativePath } from './project.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type AssetOwner =
  | { kind: 'project' }
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'prop'; id: string }
  | { kind: 'sequence'; id: string }
  | { kind: 'scene'; id: string }
  | { kind: 'sceneBeat'; sceneId: string; beatId: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'shot'; id: string };

export type AssetSelectionTarget =
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'prop'; id: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'shot'; id: string }
  | { kind: 'sceneBeat'; sceneId: string; beatId: string };

export interface AssetLocaleContext {
  localeId?: string | null;
}

export interface UpdateAssetInput {
  projectName: string;
  assetId: string;
  title?: string | null;
  oneLineSummary?: string | null;
  referenceName?: string | null;
  purpose?: string | null;
  localeId?: string | null;
}

export interface AssetUpdateReport {
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

export interface SelectAssetInput {
  projectName: string;
  target: AssetSelectionTarget;
  assetId: string;
}

export interface ClearAssetSelectionInput {
  projectName: string;
  target: AssetSelectionTarget;
}

export interface AssetSelectionReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    name: string;
    id: string;
    projectFolder: string;
  };
  target: AssetSelectionTarget;
  selectedAssetId: string | null;
  resourceKeys: string[];
}

export interface Asset {
  id: string;
  owner: AssetOwner;
  localeId: string | null;
  type: string;
  availability: AssetAvailability;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  referenceName: string | null;
  purpose: string | null;
  files: AssetFile[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetPage {
  items: Asset[];
  nextCursor: string | null;
  selectedAssetId: string | null;
}

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
