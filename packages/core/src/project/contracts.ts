import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type ProjectType = 'standaloneMovie' | 'series';
export type ProjectRelativePath = string & { readonly __brand: 'ProjectRelativePath' };

export interface Project {
  identity: ProjectIdentity;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguageCategories: VisualLanguageCategory[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  continuityReferences: ContinuityReference[];
  episodes: Episode[];
  sequences: Sequence[];
  counts: ProjectCounts;
}

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProjectShell {
  identity: ProjectIdentity;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguageCategories: VisualLanguageCategory[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  continuityReferences: ContinuityReference[];
  counts: ProjectCounts;
  navigation: ProjectShellNavigation;
}

export interface ProjectShellNavigation {
  cast: PageResponse<CastNavigationRow>;
  visualLanguage: PageResponse<VisualLanguageNavigationRow>;
  continuityReferences: PageResponse<ContinuityReferenceNavigationRow>;
  storyStructure: StoryStructureNavigation;
}

export type StoryStructureNavigation =
  | {
      projectType: 'standaloneMovie';
      sequences: PageResponse<SequenceNavigationRow>;
    }
  | {
      projectType: 'series';
      episodes: PageResponse<EpisodeNavigationRow>;
      selectedEpisodeSequences?: PageResponse<SequenceNavigationRow>;
    };

export interface CastNavigationRow {
  id: string;
  name: string;
  kind?: string;
  role?: string;
}

export interface VisualLanguageNavigationRow {
  id: string;
  categoryId: string;
  name: string;
  oneLineSummary?: string;
}

export interface ContinuityReferenceNavigationRow {
  id: string;
  kind: string;
  name: string;
  oneLineSummary?: string;
}

export interface EpisodeNavigationRow {
  id: string;
  number: number;
  title: string;
  shortTitle?: string;
  sequenceCount: number;
  sceneCount: number;
  clipCount: number;
}

export interface SequenceNavigationRow {
  id: string;
  episodeId?: string;
  number: number;
  title: string;
  shortTitle?: string;
  sceneCount: number;
  clipCount: number;
}

export interface SceneNavigationRow {
  id: string;
  sequenceId: string;
  title: string;
  clipCount: number;
}

export interface ClipNavigationRow {
  id: string;
  sceneId: string;
  title: string;
  oneLineSummary?: string;
}

export interface CastDesignResource {
  castMember: CastMember;
  descriptionAsset?: RichTextAssetLink;
  selectedAssets: Asset[];
  activeTakePage: PageResponse<Asset>;
  countsByRole: CastDesignAssetRoleCount[];
}

export interface CastDesignAssetRoleCount {
  role: string;
  selectedCount: number;
  takeCount: number;
}

export interface ClipDesignResource {
  clip: Clip;
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  episode?: EpisodeNavigationRow;
  selectedAssets: Asset[];
  activeTakePage: PageResponse<Asset>;
}

export interface ProjectInformationResource {
  title: string;
  aspectRatio?: string;
  logline?: string;
  summaryAsset?: RichTextAssetLink;
  languages: ProjectLanguage[];
}

export type MovieStudioSelectionContextResult =
  | {
      valid: true;
      selection: MovieStudioSelection;
      context: MovieStudioSelectionContext;
      resourceKeys: string[];
    }
  | {
      valid: false;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export type MovieStudioSelection =
  | { type: 'projectInformation' }
  | { type: 'visualLanguage' }
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'clip'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };

export type MovieStudioSelectionContext =
  | { surface: 'project-information' }
  | { surface: 'visual-language' }
  | { surface: 'storyboard' }
  | { surface: 'casting'; cast: PageResponse<CastNavigationRow> }
  | { surface: 'cast-design'; castMember: CastNavigationRow }
  | { surface: 'sequence'; sequence: SequenceNavigationRow; episode?: EpisodeNavigationRow }
  | { surface: 'scene'; scene: SceneNavigationRow; sequence: SequenceNavigationRow; episode?: EpisodeNavigationRow }
  | { surface: 'clip-design'; clip: ClipNavigationRow; scene: SceneNavigationRow; sequence: SequenceNavigationRow; episode?: EpisodeNavigationRow };

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
  categoryId: string;
  name: string;
  summary?: string;
  priority: VisualLanguagePriority;
  guidance?: string;
  prompt?: string;
  guidanceAsset?: RichTextAssetLink;
  promptAsset?: RichTextAssetLink;
}

export interface VisualLanguageCategory {
  id: string;
  name: string;
  description?: string;
  source: VisualLanguageCategorySource;
}

export type VisualLanguageCategorySource = 'system' | 'project';
export type VisualLanguagePriority = 'default' | 'situational' | 'rare';

export interface CastMember {
  id: string;
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
}

export interface ContinuityReference {
  id: string;
  kind: string;
  name: string;
  summary?: string;
  description?: string;
  descriptionAsset?: RichTextAssetLink;
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

export interface MarkdownAssetContent {
  assetId: string;
  assetFileId: string;
  projectRelativePath: string;
  content: string;
}

export type AssetTarget =
  | { kind: 'project' }
  | { kind: 'visualLanguage'; visualLanguageId: string }
  | { kind: 'castMember'; castMemberId: string }
  | { kind: 'continuityReference'; continuityReferenceId: string }
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

export type ProductionExportVariant =
  | { kind: 'master' }
  | { kind: 'localized'; localeId: string };

export interface ProductionExportInput {
  projectName: string;
  variants?: ProductionExportVariant[];
  fresh?: boolean;
  dryRun?: boolean;
}

export interface ProductionExportSummary {
  copiedFileCount: number;
  skippedFileCount: number;
  prunedFileCount: number;
  unmanagedFileCount: number;
  variants: ProductionExportVariantSummary[];
}

export interface ProductionExportVariantSummary {
  variant: ProductionExportVariant;
  rootProjectRelativePath: ProjectRelativePath;
  treeHash: string;
  copiedFileCount: number;
  skippedFileCount: number;
  prunedFileCount: number;
}

export interface ProjectCounts {
  languages: number;
  visualLanguageCategories: number;
  visualLanguage: number;
  castMembers: number;
  continuityReferences: number;
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
