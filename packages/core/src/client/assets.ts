import type { ProjectRelativePath } from './project.js';

export type AssetTarget =
  | { kind: 'project' }
  | { kind: 'visualLanguage'; visualLanguageId: string }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'location'; locationId: string }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string };

export interface AssetLocaleContext {
  localeId?: string | null;
}

export interface RegisterAssetInput {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string | null;
  projectRelativePath: ProjectRelativePath;
  fileRole: string;
  role: string;
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
