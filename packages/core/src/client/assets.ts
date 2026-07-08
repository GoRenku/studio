import type { ProjectRelativePath } from './project.js';

export const REFERENCE_IMAGE_MEDIA_PURPOSE = 'reference.image' as const;

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

export interface ReferenceImageMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: typeof REFERENCE_IMAGE_MEDIA_PURPOSE;
  target: AssetTarget;
  imported: Asset;
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
  selection: AssetSelection;
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

export type AssetSelection = { kind: 'take' } | { kind: 'select'; order: number };

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
