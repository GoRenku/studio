import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type ProjectType = 'standaloneMovie' | 'series';
export type ProjectRelativePath = string & { readonly __brand: 'ProjectRelativePath' };

export interface Project {
  identity: ProjectIdentity;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  episodes: Episode[];
  sequences: Sequence[];
  counts: ProjectCounts;
}

export interface ProjectLibrary {
  storageRoot: string;
  projects: ProjectSummary[];
}

export interface ProjectSummary {
  name: string;
  title: string;
  type: ProjectType;
  folderPath: string;
  coverImage: ProjectCoverImage | null;
  logline?: string;
  counts: ProjectCounts | null;
  validationError: ProjectDataError | null;
}

export interface ProjectIdentity {
  id: string;
  name: string;
  title: string;
  type: ProjectType;
  folderPath: string;
  databasePath: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
  summaryAsset?: RichTextAssetLink;
}

export interface ProjectCoverImage {
  fileName: 'cover.png';
}

export interface ProjectLanguage {
  id: string;
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}

export interface VisualLanguage {
  id: string;
  name: string;
  intent?: string;
  summary?: string;
  intentAsset?: RichTextAssetLink;
}

export interface CastMember {
  id: string;
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
}

export interface Episode {
  id: string;
  title: string;
  shortTitle?: string;
  summary?: string;
  sequences: Sequence[];
}

export interface Sequence {
  id: string;
  number: number;
  title: string;
  shortTitle?: string;
  summary?: string;
  summaryAsset?: RichTextAssetLink;
  scenes: Scene[];
}

export interface Scene {
  id: string;
  title: string;
  summary?: string;
  summaryAsset?: RichTextAssetLink;
  clips: Clip[];
}

export interface Clip {
  id: string;
  title: string;
  summary?: string;
  visualIntent?: string;
  summaryAsset?: RichTextAssetLink;
  visualIntentAsset?: RichTextAssetLink;
}

export interface RichTextAssetLink {
  assetId: string;
  assetFileId: string;
  role: string;
  localeId?: string;
  projectRelativePath: string;
}

export type AssetTarget =
  | { kind: 'project' }
  | { kind: 'visualLanguage'; visualLanguageId: string }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string }
  | { kind: 'clip'; clipId: string };

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

export interface ProjectCounts {
  languages: number;
  visualLanguage: number;
  castMembers: number;
  episodes: number;
  sequences: number;
  scenes: number;
  clips: number;
}

export interface ProjectDataError {
  code: string;
  message: string;
  issues?: DiagnosticIssue[];
  suggestion?: string;
}

export interface ProjectCreateReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
  coverPath: string | null;
  created: ProjectCounts;
  warnings: DiagnosticIssue[];
}
