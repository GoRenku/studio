import type {
  Asset,
  AssetFile,
  AssetLocaleContext,
  AssetTarget,
  ActNavigationRow,
  CastMemberResource,
  CastOverviewResource,
  CastDesignResource,
  CastNavigationRow,
  DirectorContextReport,
  CastDesignContextReport,
  CastDesignDocument,
  CastDesignListReport,
  CastDesignReadReport,
  CastDesignWriteReport,
  CastVoiceAttachmentCommandDocument,
  CastVoiceAttachmentReport,
  CastVoiceListReport,
  CastVoiceProvider,
  CastVoiceProviderCapability,
  CastVoiceProviderRegistrationListReport,
  CastVoiceProviderRegistrationModel,
  CastVoiceProviderRegistrationReadReport,
  CastVoiceProviderRegistrationRemoveReport,
  CastVoiceProviderRegistrationWriteReport,
  CastVoiceReadReport,
  CastVoiceRemoveReport,
  CastVoiceValidationReport,
  CastOperationDocument,
  DepartmentCommandReport,
  InspirationAnalysisValidationReport,
  InspirationAnalysisWriteReport,
  InspirationFolder,
  InspirationFolderReport,
  InspirationFolderDeleteReport,
  InspirationFolderMutationReport,
  InspirationFolderReorderReport,
  InspirationFolderResourceMutationReport,
  InspirationFolderResource,
  InspirationResource,
  LookbookImageMutationReport,
  LookbookSheetMutationReport,
  LookbookResource,
  LookbookSourceInspirationsReport,
  LookbooksResource,
  LookbookSection,
  LookbookType,
  LookbookValidationReport,
  LookbookWriteReport,
  LocationNavigationRow,
  LocationOverviewResource,
  LocationResource,
  LocationDesignDocument,
  LocationDesignListReport,
  LocationDesignReadReport,
  LocationDesignWriteReport,
  LocationOperationDocument,
  SceneDesignResource,
  ProductionDesignLocationContextReport,
  SceneNarrativeResource,
  ScreenplayAnalysisContextReport,
  ScreenplayAnalysisDocument,
  ScreenplayAnalysisListReport,
  ScreenplayAnalysisReadReport,
  ScreenplayAnalysisValidationReport,
  ScreenplayAnalysisWriteReport,
  SceneShotListApplyReport,
  SceneShotListContextReport,
  SceneShotListDocument,
  SceneShotListListReport,
  SceneShotListOperationDocument,
  SceneShotListReadReport,
  SceneShotListStoryboardStatus,
  SceneShotListValidationReport,
  SceneShotListWriteReport,
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
  UpdateAssetReferenceInput,
  SceneNavigationRow,
  SequenceNavigationRow,
  SequenceResource,
  StoryArcResource,
  ActStoryboardResource,
  SceneShotListResource,
  GarbageCollectionPreview,
  GarbageCollectionReport,
  RecoverableMutationReport,
  TrashListReport,
  VisualLanguageCommandReport,
} from '../client/index.js';
import type {
  InspirationAnalysisDocument,
  LookbookDocument,
  LookbookSourceInspirationsDocument,
} from './visual-language-json/validator.js';
import type {
  Act as ScreenplayAct,
  CastMember as ScreenplayCastMember,
  Location as ScreenplayLocation,
  Scene as ScreenplayScene,
  ScreenplayCommandReport,
  ScreenplayCreateDocument,
  ScreenplayDocument,
  ScreenplayOperationDocument,
  ScreenplayReadReport,
  ScreenplayRevisionListReport,
  ScreenplayRevisionReadReport,
  ScreenplaySceneRevisionDocument,
  ScreenplayStatusReport,
  Sequence as ScreenplaySequence,
} from '../client/screenplay.js';
import type { CurrentProjectReport } from './database/lifecycle/current-project.js';
import type { ProjectDatabasePreMigrationBackupReport } from './database/lifecycle/project-database-backups.js';
import type { StudioCurrent } from './studio-coordination/events.js';
import type { RenkuConfigPathOptions } from './renku-config.js';
import type { ProjectIdGenerator } from './entity-ids.js';

export type { ProjectDatabasePreMigrationBackupReport };

export interface ProjectDataService {
  createMovieProject(input: CreateMovieProjectInput): Promise<ProjectCreateReport>;
  migrateProjectDatabase(
    input: MigrateProjectDatabaseInput
  ): Promise<ProjectDatabaseMigrationReport>;
  listLibrary(input?: RenkuConfigPathOptions): Promise<ProjectLibrary>;
  readProject(input: ReadProjectInput): Promise<Project>;
  readProjectShell(input: ReadProjectInput): Promise<ProjectShell>;
  readDirectorContext(input?: ReadDirectorContextInput): Promise<DirectorContextReport>;
  readProjectInformationResource(
    input: ReadProjectInput
  ): Promise<ProjectInformationResource>;
  listCastNavigation(input: ListNavigationInput): Promise<PageResponse<CastNavigationRow>>;
  listLocationNavigation(
    input: ListNavigationInput
  ): Promise<PageResponse<LocationNavigationRow>>;
  listActNavigation(input: ListNavigationInput): Promise<PageResponse<ActNavigationRow>>;
  listSequenceNavigation(
    input: ListNavigationInput | ListSequencesForActNavigationInput
  ): Promise<PageResponse<SequenceNavigationRow>>;
  listSceneNavigation(
    input: ListSceneNavigationInput
  ): Promise<PageResponse<SceneNavigationRow>>;
  listAssetPage(input: ListAssetPageInput): Promise<PageResponse<Asset>>;
  readCastDesignResource(
    input: ReadCastDesignResourceInput
  ): Promise<CastDesignResource>;
  readSceneDesignResource(
    input: ReadSceneDesignResourceInput
  ): Promise<SceneDesignResource>;
  readCastOverviewResource(input: ListNavigationInput): Promise<CastOverviewResource>;
  readCastMemberResource(
    input: ReadCastMemberResourceInput
  ): Promise<CastMemberResource>;
  readLocationOverviewResource(
    input: ListNavigationInput
  ): Promise<LocationOverviewResource>;
  readLocationResource(input: ReadLocationResourceInput): Promise<LocationResource>;
  readStoryArcResource(input: ReadProjectInput): Promise<StoryArcResource>;
  readSequenceResource(input: ReadSequenceResourceInput): Promise<SequenceResource>;
  readSceneNarrativeResource(
    input: ReadSceneNarrativeResourceInput
  ): Promise<SceneNarrativeResource>;
  readSceneShotListResource(
    input: ReadSceneShotListResourceInput
  ): Promise<SceneShotListResource>;
  readActStoryboardResource(
    input: ReadActStoryboardResourceInput
  ): Promise<ActStoryboardResource>;
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
  resolveCoverImage(input: ResolveProjectCoverImageInput): Promise<string | null>;
  resolveProjectAssetFile(
    input: ResolveProjectAssetFileInput
  ): Promise<ResolvedProjectAssetFile>;
  resolveProjectAssetFileById(
    input: ResolveProjectAssetFileByIdInput
  ): Promise<ResolvedProjectAssetFileById>;
  updateAssetReference(input: UpdateAssetReferenceInput & RenkuConfigPathOptions): Promise<Asset>;
  listAssets(input: ListAssetsInput): Promise<Asset[]>;
  createAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  updateAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  removeAssetSelect(input: RemoveAssetSelectInput): Promise<Asset>;
  discardAsset(input: DiscardAssetInput): Promise<RecoverableMutationReport>;
  restoreAsset(input: RestoreAssetInput): Promise<RecoverableMutationReport>;
  listTrash(input: ListTrashInput): Promise<TrashListReport>;
  restoreTrashItem(input: RestoreTrashItemInput): Promise<RecoverableMutationReport>;
  previewGarbageCollection(
    input: PreviewGarbageCollectionInput
  ): Promise<GarbageCollectionPreview>;
  emptyTrash(input: EmptyTrashInput): Promise<GarbageCollectionReport>;
  listAssetSelects(input: ListAssetsInput): Promise<Asset[]>;
  exportProductionAssets(
    input: ProductionExportInput & RenkuConfigPathOptions
  ): Promise<ProductionExportSummary>;
  openCurrentProject(input: OpenCurrentProjectInput): Promise<CurrentProjectReport>;
  readCurrentProject(input?: RenkuConfigPathOptions): Promise<CurrentProjectReport | null>;
  closeCurrentProject(input?: RenkuConfigPathOptions): Promise<CurrentProjectReport | null>;
  listCastMembers(input?: RenkuConfigPathOptions): Promise<import('../client/cast-members.js').CastMember[]>;
  readCastMember(input: ReadCastMemberInput): Promise<import('../client/cast-members.js').CastMember>;
  listCastVoices(input: ListCastVoicesInput): Promise<CastVoiceListReport>;
  readCastVoice(input: ReadCastVoiceInput): Promise<CastVoiceReadReport>;
  listCastVoiceProviderRegistrations(input: ReadCastVoiceInput): Promise<CastVoiceProviderRegistrationListReport>;
  readCastVoiceProviderRegistration(input: ReadCastVoiceProviderRegistrationInput): Promise<CastVoiceProviderRegistrationReadReport>;
  createCastVoiceProviderRegistration(input: CreateCastVoiceProviderRegistrationInput): Promise<CastVoiceProviderRegistrationWriteReport>;
  removeCastVoiceProviderRegistration(input: RemoveCastVoiceProviderRegistrationInput): Promise<CastVoiceProviderRegistrationRemoveReport>;
  validateCastVoiceAttachment(input: ValidateCastVoiceAttachmentInput): Promise<CastVoiceValidationReport>;
  attachCastVoice(input: AttachCastVoiceInput): Promise<CastVoiceAttachmentReport>;
  removeCastVoice(input: RemoveCastVoiceInput): Promise<CastVoiceRemoveReport>;
  readCastContext(input: ReadCastContextInput): Promise<CastDesignContextReport>;
  updateCastMemberVoiceOverStatus(
    input: UpdateCastMemberVoiceOverStatusInput
  ): Promise<import('../client/cast-members.js').CastMember>;
  validateCastOperations(input: ValidateCastOperationsInput): Promise<DepartmentCommandReport>;
  applyCastOperations(input: ApplyCastOperationsInput): Promise<DepartmentCommandReport>;
  listCastDesigns(input: ListCastDesignsInput): Promise<CastDesignListReport>;
  readCastDesign(input: ReadCastDesignInput): Promise<CastDesignReadReport>;
  validateCastDesign(input: ValidateCastDesignInput): Promise<DepartmentCommandReport>;
  writeCastDesign(input: WriteCastDesignInput): Promise<CastDesignWriteReport>;
  setActiveCastDesign(input: SetActiveCastDesignInput): Promise<CastDesignWriteReport>;
  listLocations(input?: RenkuConfigPathOptions): Promise<import('../client/locations.js').Location[]>;
  readLocation(input: ReadLocationInput): Promise<import('../client/locations.js').Location>;
  readLocationContext(input: ReadLocationContextInput): Promise<ProductionDesignLocationContextReport>;
  validateLocationOperations(input: ValidateLocationOperationsInput): Promise<DepartmentCommandReport>;
  applyLocationOperations(input: ApplyLocationOperationsInput): Promise<DepartmentCommandReport>;
  listLocationDesigns(input: ListLocationDesignsInput): Promise<LocationDesignListReport>;
  readLocationDesign(input: ReadLocationDesignInput): Promise<LocationDesignReadReport>;
  validateLocationDesign(input: ValidateLocationDesignInput): Promise<DepartmentCommandReport>;
  writeLocationDesign(input: WriteLocationDesignInput): Promise<LocationDesignWriteReport>;
  setActiveLocationDesign(input: SetActiveLocationDesignInput): Promise<LocationDesignWriteReport>;
  readScreenplayStatus(input?: RenkuConfigPathOptions): Promise<ScreenplayStatusReport>;
  readScreenplay(input?: RenkuConfigPathOptions): Promise<ScreenplayReadReport>;
  listScreenplayCastMembers(input?: RenkuConfigPathOptions): Promise<ScreenplayCastMember[]>;
  readScreenplayCastMember(input: ReadScreenplayCastMemberInput): Promise<ScreenplayCastMember>;
  listScreenplayLocations(input?: RenkuConfigPathOptions): Promise<ScreenplayLocation[]>;
  readScreenplayLocation(input: ReadScreenplayLocationInput): Promise<ScreenplayLocation>;
  listScreenplayActs(input?: RenkuConfigPathOptions): Promise<ScreenplayAct[]>;
  readScreenplayAct(input: ReadScreenplayActInput): Promise<ScreenplayAct>;
  listScreenplaySequencesForAct(input: ListScreenplaySequencesForActInput): Promise<ScreenplaySequence[]>;
  readScreenplaySequence(input: ReadScreenplaySequenceInput): Promise<ScreenplaySequence>;
  listScreenplayScenesForSequence(input: ListScreenplayScenesForSequenceInput): Promise<ScreenplayScene[]>;
  readScreenplayScene(input: ReadScreenplaySceneInput): Promise<ScreenplayScene>;
  validateScreenplayJson(input: ValidateScreenplayJsonInput): Promise<ScreenplayCommandReport>;
  createScreenplay(input: CreateScreenplayInput): Promise<ScreenplayCommandReport>;
  applyScreenplayOperations(input: ApplyScreenplayOperationsInput): Promise<ScreenplayCommandReport>;
  reviseScreenplayScene(input: ReviseScreenplaySceneInput): Promise<ScreenplayCommandReport>;
  listScreenplayRevisions(input?: RenkuConfigPathOptions): Promise<ScreenplayRevisionListReport>;
  readScreenplayRevision(input: ReadScreenplayRevisionInput): Promise<ScreenplayRevisionReadReport>;
  restoreScreenplayRevision(input: RestoreScreenplayRevisionInput): Promise<ScreenplayCommandReport>;
  readScreenplayAnalysisContext(input?: ScreenplayAnalysisProjectInput): Promise<ScreenplayAnalysisContextReport>;
  listScreenplayAnalyses(input?: ScreenplayAnalysisProjectInput): Promise<ScreenplayAnalysisListReport>;
  readScreenplayAnalysis(input: ReadScreenplayAnalysisInput): Promise<ScreenplayAnalysisReadReport>;
  validateScreenplayAnalysis(input: ValidateScreenplayAnalysisInput): Promise<ScreenplayAnalysisValidationReport>;
  writeScreenplayAnalysis(input: WriteScreenplayAnalysisInput): Promise<ScreenplayAnalysisWriteReport>;
  setActiveScreenplayAnalysis(input: SetActiveScreenplayAnalysisInput): Promise<ScreenplayAnalysisWriteReport>;
  readSceneShotListContext(input: ReadSceneShotListContextInput): Promise<SceneShotListContextReport>;
  listSceneShotLists(input: ListSceneShotListsInput): Promise<SceneShotListListReport>;
  readSceneShotList(input: ReadSceneShotListInput): Promise<SceneShotListReadReport>;
  validateSceneShotList(input: ValidateSceneShotListInput): Promise<SceneShotListValidationReport>;
  writeSceneShotList(input: WriteSceneShotListInput): Promise<SceneShotListWriteReport>;
  setActiveSceneShotList(input: SetActiveSceneShotListInput): Promise<SceneShotListWriteReport>;
  validateSceneShotListOperations(input: ApplySceneShotListOperationsInput): Promise<SceneShotListApplyReport>;
  applySceneShotListOperations(input: ApplySceneShotListOperationsInput): Promise<SceneShotListApplyReport>;
  readSceneShotListStoryboardStatus(input: ReadSceneShotListStoryboardStatusInput): Promise<SceneShotListStoryboardStatus>;
  listInspirationFolders(input: ListInspirationFoldersInput): Promise<PageResponse<InspirationFolder>>;
  readInspirationResource(input: ListInspirationFoldersInput): Promise<InspirationResource>;
  readInspirationFolder(input: ReadInspirationFolderInput): Promise<InspirationFolderResource>;
  createInspirationFolder(input: CreateInspirationFolderInput): Promise<InspirationFolderMutationReport>;
  renameInspirationFolder(input: RenameInspirationFolderInput): Promise<InspirationFolderMutationReport>;
  reorderInspirationFolders(input: ReorderInspirationFoldersInput): Promise<InspirationFolderReorderReport>;
  deleteInspirationFolder(input: DeleteInspirationFolderInput): Promise<InspirationFolderDeleteReport>;
  writeInspirationImage(input: WriteInspirationImageInput): Promise<InspirationFolderResourceMutationReport>;
  deleteInspirationImage(input: DeleteInspirationImageInput): Promise<InspirationFolderResourceMutationReport>;
  readInspirationAnalysis(input: ReadInspirationAnalysisInput): Promise<InspirationFolderReport>;
  validateInspirationAnalysis(input: ValidateInspirationAnalysisInput): Promise<InspirationAnalysisValidationReport>;
  writeInspirationAnalysis(input: WriteInspirationAnalysisInput): Promise<InspirationAnalysisWriteReport>;
  listLookbooks(input: ListLookbooksInput): Promise<LookbooksResource>;
  readLookbook(input: ReadLookbookInput): Promise<LookbookResource>;
  validateLookbook(input: ValidateLookbookInput): Promise<LookbookValidationReport>;
  createLookbook(input: CreateLookbookInput): Promise<LookbookWriteReport>;
  updateLookbook(input: UpdateLookbookInput): Promise<LookbookWriteReport>;
  renameLookbook(input: RenameLookbookInput): Promise<LookbookWriteReport>;
  deleteLookbook(input: DeleteLookbookInput): Promise<VisualLanguageCommandReport>;
  selectLookbookForType(input: SelectLookbookForTypeInput): Promise<VisualLanguageCommandReport>;
  clearLookbookSelection(input: ClearLookbookSelectionInput): Promise<VisualLanguageCommandReport>;
  setLookbookSourceInspirations(input: SetLookbookSourceInspirationsInput): Promise<LookbookWriteReport>;
  listLookbookSourceInspirations(input: ListLookbookSourceInspirationsInput): Promise<LookbookSourceInspirationsReport>;
  setLookbookCardImage(input: SetLookbookCardImageInput): Promise<LookbookImageMutationReport>;
  clearLookbookCardImage(input: ClearLookbookCardImageInput): Promise<LookbookImageMutationReport>;
  deleteLookbookImage(input: DeleteLookbookImageInput): Promise<LookbookImageMutationReport>;
  deleteLookbookSheet(input: DeleteLookbookSheetInput): Promise<LookbookSheetMutationReport>;
  setLookbookImagePlacement(input: SetLookbookImagePlacementInput): Promise<LookbookImageMutationReport>;
}

export interface CreateMovieProjectInput extends RenkuConfigPathOptions {
  projectName: string;
  title: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface MigrateProjectDatabaseInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface ListTrashInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface RestoreTrashItemInput extends RenkuConfigPathOptions {
  projectName: string;
  trashItemId: string;
}

export interface PreviewGarbageCollectionInput extends RenkuConfigPathOptions {
  projectName: string;
  olderThanIso?: string;
}

export interface EmptyTrashInput extends PreviewGarbageCollectionInput {
  confirmationToken: string;
  dryRun?: boolean;
}

export interface OpenCurrentProjectInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface ProjectDatabaseMigrationReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
  preMigrationBackup: ProjectDatabasePreMigrationBackupReport | null;
}

export interface ReadProjectInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface ReadDirectorContextInput extends RenkuConfigPathOptions {
  selection?: StudioSelection;
  studioCurrent?: StudioCurrent;
}

export interface ReadCastMemberInput extends RenkuConfigPathOptions {
  castMemberId: string;
}

export interface ListCastVoicesInput extends RenkuConfigPathOptions {
  projectName?: string;
  castMemberId: string;
}

export interface ReadCastVoiceInput extends ListCastVoicesInput {
  voiceIdOrName: string;
}

export interface ReadCastVoiceProviderRegistrationInput extends ReadCastVoiceInput {
  registrationId: string;
}

export interface CreateCastVoiceProviderRegistrationInput extends ReadCastVoiceInput {
  registration: {
    provider: CastVoiceProvider;
    registrationModel: CastVoiceProviderRegistrationModel;
    externalVoiceId: string;
    capabilities: CastVoiceProviderCapability[];
    sourceSampleAssetId?: string | null;
  };
  idGenerator?: ProjectIdGenerator;
}

export interface RemoveCastVoiceProviderRegistrationInput
  extends ReadCastVoiceProviderRegistrationInput {}

export interface ValidateCastVoiceAttachmentInput extends RenkuConfigPathOptions {
  projectName?: string;
  document: CastVoiceAttachmentCommandDocument;
}

export interface AttachCastVoiceInput extends ValidateCastVoiceAttachmentInput {
  idGenerator?: ProjectIdGenerator;
  elevenLabsVoiceSampleFetcher?: ElevenLabsVoiceSampleFetcher;
}

export interface RemoveCastVoiceInput extends ReadCastVoiceInput {}

export interface ElevenLabsVoiceSampleFetcher {
  (input: {
    voiceId: string;
  }): Promise<{
    provider: 'elevenlabs';
    voiceId: string;
    sampleId: string;
    voiceName: string | null;
    sampleFileName: string | null;
    mimeType: 'audio/mpeg';
    audioBytes: Buffer;
    fetchedAt: string;
    apiBaseUrl: string;
    contentLength: number;
  }>;
}

export interface ReadCastContextInput extends RenkuConfigPathOptions {
  castMemberId: string;
}

export interface ValidateCastOperationsInput extends RenkuConfigPathOptions {
  document: CastOperationDocument;
  filePath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ApplyCastOperationsInput extends ValidateCastOperationsInput {
  dryRun?: boolean;
}

export interface UpdateCastMemberVoiceOverStatusInput
  extends RenkuConfigPathOptions {
  projectName: string;
  castMemberId: string;
  isVoiceOver: boolean;
}

export interface ListCastDesignsInput extends RenkuConfigPathOptions {
  castMemberId: string;
}

export interface ReadCastDesignInput extends RenkuConfigPathOptions {
  castMemberId?: string;
  designId?: string;
  active?: boolean;
}

export interface ValidateCastDesignInput extends RenkuConfigPathOptions {
  document: CastDesignDocument;
  filePath?: string;
}

export interface WriteCastDesignInput extends ValidateCastDesignInput {
  idGenerator?: ProjectIdGenerator;
}

export interface SetActiveCastDesignInput extends RenkuConfigPathOptions {
  castMemberId: string;
  designId: string;
}

export interface ReadLocationInput extends RenkuConfigPathOptions {
  locationId: string;
}

export interface ReadLocationContextInput extends RenkuConfigPathOptions {
  locationId: string;
}

export interface ValidateLocationOperationsInput extends RenkuConfigPathOptions {
  document: LocationOperationDocument;
  filePath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ApplyLocationOperationsInput extends ValidateLocationOperationsInput {
  dryRun?: boolean;
}

export interface ListLocationDesignsInput extends RenkuConfigPathOptions {
  locationId: string;
}

export interface ReadLocationDesignInput extends RenkuConfigPathOptions {
  locationId?: string;
  designId?: string;
  active?: boolean;
}

export interface ValidateLocationDesignInput extends RenkuConfigPathOptions {
  document: LocationDesignDocument;
  filePath?: string;
}

export interface WriteLocationDesignInput extends ValidateLocationDesignInput {
  idGenerator?: ProjectIdGenerator;
}

export interface SetActiveLocationDesignInput extends RenkuConfigPathOptions {
  locationId: string;
  designId: string;
}

export interface ReadScreenplayCastMemberInput extends RenkuConfigPathOptions {
  castMemberId: string;
}

export interface ReadScreenplayLocationInput extends RenkuConfigPathOptions {
  locationId: string;
}

export interface ReadScreenplayActInput extends RenkuConfigPathOptions {
  actId: string;
}

export interface ListScreenplaySequencesForActInput extends RenkuConfigPathOptions {
  actId: string;
}

export interface ReadScreenplaySequenceInput extends RenkuConfigPathOptions {
  sequenceId: string;
}

export interface ListScreenplayScenesForSequenceInput extends RenkuConfigPathOptions {
  sequenceId: string;
}

export interface ReadScreenplaySceneInput extends RenkuConfigPathOptions {
  sceneId: string;
}

export interface ValidateScreenplayJsonInput extends RenkuConfigPathOptions {
  document?:
    | ScreenplayDocument
    | ScreenplayCreateDocument
    | ScreenplayOperationDocument
    | ScreenplaySceneRevisionDocument;
  filePath?: string;
}

export interface CreateScreenplayInput extends RenkuConfigPathOptions {
  document: ScreenplayCreateDocument;
  filePath?: string;
  dryRun?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface ApplyScreenplayOperationsInput extends RenkuConfigPathOptions {
  document: ScreenplayOperationDocument;
  filePath?: string;
  dryRun?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface ReviseScreenplaySceneInput extends RenkuConfigPathOptions {
  sceneId: string;
  document: ScreenplaySceneRevisionDocument;
  filePath?: string;
  dryRun?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface ReadScreenplayRevisionInput extends RenkuConfigPathOptions {
  revisionId: string;
}

export interface RestoreScreenplayRevisionInput extends RenkuConfigPathOptions {
  revisionId: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ScreenplayAnalysisProjectInput extends RenkuConfigPathOptions {}

export interface ReadScreenplayAnalysisInput extends ScreenplayAnalysisProjectInput {
  active?: boolean;
  analysisId?: string;
}

export interface ValidateScreenplayAnalysisInput extends ScreenplayAnalysisProjectInput {
  document: ScreenplayAnalysisDocument;
  filePath?: string;
}

export interface WriteScreenplayAnalysisInput extends ValidateScreenplayAnalysisInput {
  idGenerator?: ProjectIdGenerator;
}

export interface SetActiveScreenplayAnalysisInput extends ScreenplayAnalysisProjectInput {
  analysisId: string;
}

export interface SceneShotListProjectInput extends RenkuConfigPathOptions {}

export interface ReadSceneShotListContextInput extends SceneShotListProjectInput {
  sceneId: string;
  includeVisualReferences?: boolean;
}

export interface ListSceneShotListsInput extends SceneShotListProjectInput {
  sceneId: string;
}

export interface ReadSceneShotListInput extends SceneShotListProjectInput {
  active?: boolean;
  sceneId?: string;
  shotListId?: string;
}

export interface ValidateSceneShotListInput extends SceneShotListProjectInput {
  document: SceneShotListDocument;
  filePath?: string;
}

export interface WriteSceneShotListInput extends ValidateSceneShotListInput {
  idGenerator?: ProjectIdGenerator;
}

export interface SetActiveSceneShotListInput extends SceneShotListProjectInput {
  sceneId: string;
  shotListId: string;
}

export interface ApplySceneShotListOperationsInput
  extends SceneShotListProjectInput {
  document: SceneShotListOperationDocument;
  filePath?: string;
  dryRun?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface ReadSceneShotListStoryboardStatusInput
  extends SceneShotListProjectInput {
  sceneId: string;
  shotListId: string;
}

export interface VisualLanguageProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface ListInspirationFoldersInput extends VisualLanguageProjectInput {
  limit?: number;
  cursor?: string | null;
}

export interface ReadInspirationFolderInput extends VisualLanguageProjectInput {
  folderId: string;
}

export interface CreateInspirationFolderInput extends VisualLanguageProjectInput {
  name: string;
  idGenerator?: ProjectIdGenerator;
}

export interface RenameInspirationFolderInput extends VisualLanguageProjectInput {
  folderId: string;
  name: string;
}

export interface ReorderInspirationFoldersInput extends VisualLanguageProjectInput {
  folderIds: string[];
}

export interface DeleteInspirationFolderInput extends VisualLanguageProjectInput {
  folderId: string;
}

export interface WriteInspirationImageInput extends VisualLanguageProjectInput {
  folderId: string;
  fileName: string;
  contents: ArrayBuffer | Uint8Array;
}

export interface DeleteInspirationImageInput extends VisualLanguageProjectInput {
  folderId: string;
  fileName: string;
}

export interface ReadInspirationAnalysisInput extends VisualLanguageProjectInput {
  folderId: string;
}

export interface ValidateInspirationAnalysisInput extends VisualLanguageProjectInput {
  folderId: string;
  document: InspirationAnalysisDocument;
  filePath?: string;
}

export interface WriteInspirationAnalysisInput extends VisualLanguageProjectInput {
  folderId: string;
  document: InspirationAnalysisDocument;
  filePath?: string;
}

export interface ListLookbooksInput extends VisualLanguageProjectInput {}

export interface ReadLookbookInput extends VisualLanguageProjectInput {
  lookbookId: string;
}

export interface CreateLookbookInput extends VisualLanguageProjectInput {
  name?: string;
  document: LookbookDocument;
  filePath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateLookbookInput extends VisualLanguageProjectInput {
  lookbookId: string;
  name?: string;
  document?: LookbookDocument;
  filePath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ValidateLookbookInput extends VisualLanguageProjectInput {
  document: LookbookDocument;
  filePath?: string;
}

export interface RenameLookbookInput extends VisualLanguageProjectInput {
  lookbookId: string;
  name: string;
}

export interface DeleteLookbookInput extends VisualLanguageProjectInput {
  lookbookId: string;
}

export interface SelectLookbookForTypeInput extends VisualLanguageProjectInput {
  type: LookbookType;
  lookbookId: string;
}

export interface ClearLookbookSelectionInput extends VisualLanguageProjectInput {
  type: LookbookType;
}

export interface SetLookbookSourceInspirationsInput extends VisualLanguageProjectInput {
  lookbookId: string;
  document: LookbookSourceInspirationsDocument;
  filePath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ListLookbookSourceInspirationsInput extends VisualLanguageProjectInput {
  lookbookId: string;
}

export interface SetLookbookCardImageInput extends VisualLanguageProjectInput {
  lookbookId: string;
  imageId: string;
}

export interface ClearLookbookCardImageInput extends VisualLanguageProjectInput {
  lookbookId: string;
}

export interface DeleteLookbookImageInput extends VisualLanguageProjectInput {
  imageId: string;
}

export interface DeleteLookbookSheetInput extends VisualLanguageProjectInput {
  sheetId: string;
}

export interface SetLookbookImagePlacementInput extends VisualLanguageProjectInput {
  imageId: string;
  sections: LookbookSection[];
  anchorPointId?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ListNavigationInput extends RenkuConfigPathOptions {
  projectName: string;
  limit?: number;
  cursor?: string | null;
}

export interface ListSequencesForActNavigationInput extends ListNavigationInput {
  actId: string;
}

export interface ListSceneNavigationInput extends ListNavigationInput {
  sequenceId: string;
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

export interface ReadCastMemberResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  castMemberId: string;
}

export interface ReadLocationResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  locationId: string;
}

export interface ReadSequenceResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  sequenceId: string;
  limit?: number;
  cursor?: string | null;
}

export interface ReadSceneNarrativeResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  sceneId: string;
}

export interface ReadSceneShotListResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  sceneId: string;
}

export interface ReadActStoryboardResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  actId: string;
}

export interface ReadSceneDesignResourceInput
  extends RenkuConfigPathOptions {
  projectName: string;
  sceneId: string;
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

export interface ResolveProjectAssetFileByIdInput extends RenkuConfigPathOptions {
  projectName: string;
  assetId: string;
  assetFileId: string;
}

export interface ResolvedProjectAssetFileById {
  assetId: string;
  assetMediaKind: string;
  file: AssetFile;
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

export interface DiscardAssetInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
}

export interface RestoreAssetInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
}
