import type {
  Asset,
  AssetLocaleContext,
  AssetTarget,
  CastDesignResource,
  CastNavigationRow,
  ClipDesignResource,
  ClipNavigationRow,
  ContinuityReferenceNavigationRow,
  EpisodeNavigationRow,
  MarkdownAssetContent,
  StudioSelection,
  StudioSelectionContextResult,
  PageResponse,
  Project,
  ProjectCreateReport,
  ProjectInformationResource,
  ProjectLibrary,
  ProjectShell,
  ProductionExportInput,
  ProductionExportSummary,
  RegisterAssetInput,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '../client/index.js';
import type { RenkuConfigPathOptions } from './renku-config.js';
import type { ProjectIdGenerator } from './entity-ids.js';

export interface ProjectDataService {
  createFromSetup(input: CreateProjectFromSetupInput): Promise<ProjectCreateReport>;
  migrateProjectDatabase(
    input: MigrateProjectDatabaseInput
  ): Promise<ProjectDatabaseMigrationReport>;
  listLibrary(input?: RenkuConfigPathOptions): Promise<ProjectLibrary>;
  readProject(input: ReadProjectInput): Promise<Project>;
  readProjectShell(input: ReadProjectInput): Promise<ProjectShell>;
  readProjectInformationResource(
    input: ReadProjectInput
  ): Promise<ProjectInformationResource>;
  listCastNavigation(input: ListNavigationInput): Promise<PageResponse<CastNavigationRow>>;
  listContinuityReferenceNavigation(
    input: ListNavigationInput
  ): Promise<PageResponse<ContinuityReferenceNavigationRow>>;
  listEpisodeNavigation(
    input: ListNavigationInput
  ): Promise<PageResponse<EpisodeNavigationRow>>;
  listStandaloneMovieSequenceNavigation(
    input: ListNavigationInput
  ): Promise<PageResponse<SequenceNavigationRow>>;
  listEpisodeSequenceNavigation(
    input: ListEpisodeSequenceNavigationInput
  ): Promise<PageResponse<SequenceNavigationRow>>;
  listSceneNavigation(
    input: ListSceneNavigationInput
  ): Promise<PageResponse<SceneNavigationRow>>;
  listClipNavigation(
    input: ListClipNavigationInput
  ): Promise<PageResponse<ClipNavigationRow>>;
  listAssetPage(input: ListAssetPageInput): Promise<PageResponse<Asset>>;
  readCastDesignResource(
    input: ReadCastDesignResourceInput
  ): Promise<CastDesignResource>;
  readClipDesignResource(
    input: ReadClipDesignResourceInput
  ): Promise<ClipDesignResource>;
  readStudioSelectionContext(input: {
    projectName: string;
    selection: StudioSelection;
    homeDir?: string;
  }): Promise<StudioSelectionContextResult>;
  updateProjectInformation(
    input: UpdateProjectInformationInput
  ): Promise<ProjectInformationResource>;
  patchProjectInformation(
    input: PatchProjectInformationInput
  ): Promise<ProjectInformationResource>;
  readMarkdownAssetContent(
    input: ReadMarkdownAssetContentInput
  ): Promise<MarkdownAssetContent>;
  updateMarkdownAssetContent(
    input: UpdateMarkdownAssetContentInput
  ): Promise<UpdateMarkdownAssetContentResult>;
  resolveCoverImage(input: ResolveProjectCoverImageInput): Promise<string | null>;
  resolveProjectAssetFile(
    input: ResolveProjectAssetFileInput
  ): Promise<ResolvedProjectAssetFile>;
  registerAsset(input: RegisterAssetInput & RenkuConfigPathOptions): Promise<Asset>;
  listAssets(input: ListAssetsInput): Promise<Asset[]>;
  createAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  updateAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  removeAssetSelect(input: RemoveAssetSelectInput): Promise<Asset>;
  listAssetSelects(input: ListAssetsInput): Promise<Asset[]>;
  exportProductionAssets(
    input: ProductionExportInput & RenkuConfigPathOptions
  ): Promise<ProductionExportSummary>;
}

export interface CreateProjectFromSetupInput extends RenkuConfigPathOptions {
  setupPath: string;
  idGenerator?: ProjectIdGenerator;
}

export interface MigrateProjectDatabaseInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface ProjectDatabaseMigrationReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
}

export interface ReadProjectInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface ListNavigationInput extends RenkuConfigPathOptions {
  projectName: string;
  limit?: number;
  cursor?: string | null;
}

export interface ListEpisodeSequenceNavigationInput
  extends ListNavigationInput {
  episodeId: string;
}

export interface ListSceneNavigationInput extends ListNavigationInput {
  sequenceId: string;
}

export interface ListClipNavigationInput extends ListNavigationInput {
  sceneId: string;
}

export interface ListAssetPageInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
  role?: string;
  mediaKind?: string;
  selection?: 'take' | 'select';
  limit?: number;
  cursor?: string | null;
}

export interface ReadCastDesignResourceInput
  extends RenkuConfigPathOptions {
  projectName: string;
  castMemberId: string;
  activeRole?: string;
  limit?: number;
  cursor?: string | null;
}

export interface ReadClipDesignResourceInput
  extends RenkuConfigPathOptions {
  projectName: string;
  clipId: string;
  activeRole?: string;
  limit?: number;
  cursor?: string | null;
}

export interface UpdateProjectInformationInput extends RenkuConfigPathOptions {
  projectName: string;
  information: ProjectInformationUpdate;
}

export interface PatchProjectInformationInput extends RenkuConfigPathOptions {
  projectName: string;
  patch: ProjectInformationPatch;
}

export interface ReadMarkdownAssetContentInput extends RenkuConfigPathOptions {
  projectName: string;
  assetId: string;
  assetFileId: string;
}

export interface UpdateMarkdownAssetContentInput
  extends ReadMarkdownAssetContentInput {
  content: string;
}

export interface UpdateMarkdownAssetContentResult {
  content: MarkdownAssetContent;
  resourceKeys: string[];
}

export interface ProjectInformationPatch {
  title?: string;
  aspectRatio?: string | null;
  logline?: string | null;
  summary?: string | null;
  languages?: ProjectLanguagePatchOperation[];
}

export type ProjectLanguagePatchOperation =
  | {
      operation: 'add';
      localeTag: string;
      displayName?: string;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | {
      operation: 'update';
      localeTag: string;
      displayName?: string | null;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | { operation: 'remove'; localeTag: string }
  | { operation: 'setBase'; localeTag: string };

export interface ProjectInformationUpdate {
  title: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string | null;
  languages: ProjectInformationLanguageUpdate[];
}

export interface ProjectInformationLanguageUpdate {
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}

export interface ResolveProjectCoverImageInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface ResolveProjectAssetFileInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
  assetFileId: string;
}

export interface ResolvedProjectAssetFile {
  asset: Asset;
  file: Asset['files'][number];
  absolutePath: string;
}

export interface ListAssetsInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
}

export interface ChangeAssetSelectInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
  selectionOrder?: number;
}

export interface RemoveAssetSelectInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
}
