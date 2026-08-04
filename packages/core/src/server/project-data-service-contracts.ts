import type {
  Asset,
  AssetFile,
  AssetLocaleContext,
  AssetOwner,
  AssetPage,
  AssetSelectionReport,
  AssetSelectionTarget,
  AssetUpdateReport,
  CastMemberResource,
  CastOverviewResource,
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
  ProjectLookbooksResource,
  LookbookSection,
  LookbookValidationReport,
  LookbookWriteReport,
  LocationNavigationRow,
  LocationOverviewResource,
  LocationResource,
  PropNavigationRow,
  PropOverviewResource,
  PropResource,
  LocationDesignDocument,
  LocationDesignListReport,
  LocationDesignReadReport,
  LocationDesignWriteReport,
  LocationOperationDocument,
  SceneDesignResource,
  ProductionDesignLocationContextReport,
  ProductionDesignPropContextReport,
  PropDesignDocument,
  PropDesignListReport,
  PropDesignReadReport,
  PropDesignWriteReport,
  PropOperationDocument,
  SceneNarrativeResource,
  ScreenplayAnalysisContextReport,
  ScreenplayAnalysis,
  ScreenplayAnalysisListReport,
  ScreenplayAnalysisReadReport,
  ScreenplayAnalysisValidationReport,
  ScreenplayAnalysisWriteReport,
  SceneBeatSheetApplyReport,
  SceneBeatSheetContextReport,
  SceneBeatSheetDocument,
  SceneBeatSheetListReport,
  SceneBeatSheetOperationDocument,
  SceneBeatSheetReadReport,
  SceneBeatSheetStoryboardStatus,
  SceneBeatSheetValidationReport,
  SceneBeatSheetWriteReport,
  StudioSelection,
  StudioSelectionContextResult,
  PageResponse,
  Project,
  ProjectCreateReport,
  ProjectInformationResource,
  ProjectLibrary,
  ProjectShell,
  UpdateAssetInput,
  StoryArcResource,
  SceneBeatSheetResource,
  GarbageCollectionPreview,
  GarbageCollectionReport,
  RecoverableMutationReport,
  TrashListReport,
  CreateShotPlanInput,
  UpdateShotPlanDetailsInput,
  AddShotToPlanInput,
  UpdateShotInPlanInput,
  MoveShotInPlanInput,
  RemoveShotFromPlanInput,
  DiscardShotImageCandidateInput,
  CopyShotPlanInput,
  ReadShotPlanInput,
  ListSceneShotPlansInput,
  ShotPlanReport,
  ShotPlanListReport,
  ShotPlanValidationReport,
  DeleteShotPlanInput,
  ListSceneShotPlanVideoGenerationsInput,
  SceneShotPlanVideoGenerations,
} from '../client/index.js';
import type {
  ScreenplayInput,
  ScreenplayMutationReport,
  ScreenplayOperationsInput,
  ScreenplayRevisionListReport,
  ScreenplayRevisionReadReport,
  ScreenplaySceneResource,
  ScreenplaySectionResource,
  ScreenplayStatusReport,
  ScreenplayStructureResource,
  SceneProductionNumberListReport,
  SceneProductionNumberResolveReport,
} from '../client/screenplay/index.js';
import type {
  InspirationAnalysisDocument,
  LookbookSourceInspirationsDocument,
  ProductionLookbookDocument,
  StoryboardLookbookDocument,
} from './visual-language-json/validator.js';
import type { CurrentProjectReport } from './database/lifecycle/current-project.js';
import type { ProjectDatabasePreMigrationBackupReport } from './database/lifecycle/project-database-backups.js';
import type {
  StudioCurrent,
  StudioProjectRef,
} from './studio-coordination/events.js';
import type { RenkuConfigPathOptions } from './renku-config.js';
import type { ProjectIdGenerator } from './entity-ids.js';
import type {
  ImportFdxScreenplayInput,
  ImportFdxScreenplayReport,
} from './screenplay/fdx/contracts.js';

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
  listPropNavigation(
    input: ListNavigationInput
  ): Promise<PageResponse<PropNavigationRow>>;
  listAssetPage(input: ListAssetPageInput): Promise<AssetPage>;
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
  readPropOverviewResource(input: ListNavigationInput): Promise<PropOverviewResource>;
  readPropResource(input: ReadPropResourceInput): Promise<PropResource>;
  readStoryArcResource(input: ReadProjectInput): Promise<StoryArcResource>;
  readSceneNarrativeResource(
    input: ReadSceneNarrativeResourceInput
  ): Promise<SceneNarrativeResource>;
  readSceneBeatSheetResource(
    input: ReadSceneBeatSheetResourceInput
  ): Promise<SceneBeatSheetResource>;
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
  updateAsset(input: UpdateAssetInput & RenkuConfigPathOptions): Promise<AssetUpdateReport>;
  listAssets(input: ListAssetsInput): Promise<Asset[]>;
  selectAsset(input: RenkuConfigPathOptions & {
    projectName: string;
    target: AssetSelectionTarget;
    assetId: string;
  }): Promise<AssetSelectionReport>;
  clearAssetSelection(input: RenkuConfigPathOptions & {
    projectName: string;
    target: AssetSelectionTarget;
  }): Promise<AssetSelectionReport>;
  discardAsset(input: DiscardAssetInput): Promise<RecoverableMutationReport>;
  restoreAsset(input: RestoreAssetInput): Promise<RecoverableMutationReport>;
  listTrash(input: ListTrashInput): Promise<TrashListReport>;
  restoreTrashItem(input: RestoreTrashItemInput): Promise<RecoverableMutationReport>;
  previewGarbageCollection(
    input: PreviewGarbageCollectionInput
  ): Promise<GarbageCollectionPreview>;
  emptyTrash(input: EmptyTrashInput): Promise<GarbageCollectionReport>;
  createShotPlan(input: CreateShotPlanInput): Promise<ShotPlanReport>;
  validateShotPlanDocument(input: {
    document: unknown;
  }): Promise<ShotPlanValidationReport>;
  updateShotPlanDetails(
    input: UpdateShotPlanDetailsInput
  ): Promise<ShotPlanReport>;
  addShotToPlan(input: AddShotToPlanInput): Promise<ShotPlanReport>;
  updateShotInPlan(input: UpdateShotInPlanInput): Promise<ShotPlanReport>;
  moveShotInPlan(input: MoveShotInPlanInput): Promise<ShotPlanReport>;
  removeShotFromPlan(
    input: RemoveShotFromPlanInput
  ): Promise<RecoverableMutationReport>;
  copyShotPlan(input: CopyShotPlanInput): Promise<ShotPlanReport>;
  readShotPlan(input: ReadShotPlanInput): Promise<ShotPlanReport>;
  listSceneShotPlans(
    input: ListSceneShotPlansInput
  ): Promise<ShotPlanListReport>;
  listSceneShotPlanVideoGenerations(
    input: ListSceneShotPlanVideoGenerationsInput
  ): Promise<SceneShotPlanVideoGenerations>;
  deleteShotPlan(
    input: DeleteShotPlanInput
  ): Promise<RecoverableMutationReport>;
  discardShotImageCandidate(
    input: DiscardShotImageCandidateInput
  ): Promise<RecoverableMutationReport>;
  openCurrentProject(input: OpenCurrentProjectInput): Promise<CurrentProjectReport>;
  readCurrentProject(input?: RenkuConfigPathOptions): Promise<CurrentProjectReport | null>;
  closeCurrentProject(input?: RenkuConfigPathOptions): Promise<CurrentProjectReport | null>;
  resolveStudioProjectRef(
    input: RenkuConfigPathOptions & { projectName?: string }
  ): Promise<StudioProjectRef>;
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
  listProps(input?: RenkuConfigPathOptions): Promise<import('../client/props.js').Prop[]>;
  readProp(input: ReadPropInput): Promise<import('../client/props.js').Prop>;
  readPropContext(input: ReadPropContextInput): Promise<ProductionDesignPropContextReport>;
  validatePropOperations(input: ValidatePropOperationsInput): Promise<DepartmentCommandReport>;
  applyPropOperations(input: ApplyPropOperationsInput): Promise<DepartmentCommandReport>;
  listPropDesigns(input: ListPropDesignsInput): Promise<PropDesignListReport>;
  readPropDesign(input: ReadPropDesignInput): Promise<PropDesignReadReport>;
  validatePropDesign(input: ValidatePropDesignInput): Promise<DepartmentCommandReport>;
  writePropDesign(input: WritePropDesignInput): Promise<PropDesignWriteReport>;
  setActivePropDesign(input: SetActivePropDesignInput): Promise<PropDesignWriteReport>;
  readScreenplayStatus(input: ScreenplayProjectInput): Promise<ScreenplayStatusReport>;
  readScreenplayStructure(input: ScreenplayProjectInput): Promise<ScreenplayStructureResource>;
  readScreenplaySection(input: ReadScreenplaySectionInput): Promise<ScreenplaySectionResource>;
  readScreenplayScene(input: ReadScreenplaySceneInput): Promise<ScreenplaySceneResource>;
  listSceneProductionNumbers(input: ScreenplayProjectInput): Promise<SceneProductionNumberListReport>;
  resolveSceneProductionNumber(input: ResolveSceneProductionNumberInput): Promise<SceneProductionNumberResolveReport>;
  createScreenplay(input: CreateScreenplayInput): Promise<ScreenplayMutationReport>;
  importFdxScreenplay(input: ImportFdxScreenplayInput): Promise<ImportFdxScreenplayReport>;
  applyScreenplayOperations(input: ApplyScreenplayOperationsInput): Promise<ScreenplayMutationReport>;
  listScreenplayRevisions(input: ScreenplayProjectInput): Promise<ScreenplayRevisionListReport>;
  readScreenplayRevision(input: ReadScreenplayRevisionInput): Promise<ScreenplayRevisionReadReport>;
  restoreScreenplayRevision(input: RestoreScreenplayRevisionInput): Promise<ScreenplayMutationReport>;
  readScreenplayAnalysisContext(input?: ScreenplayAnalysisProjectInput): Promise<ScreenplayAnalysisContextReport>;
  listScreenplayAnalyses(input?: ScreenplayAnalysisProjectInput): Promise<ScreenplayAnalysisListReport>;
  readScreenplayAnalysis(input: ReadScreenplayAnalysisInput): Promise<ScreenplayAnalysisReadReport>;
  validateScreenplayAnalysis(input: ValidateScreenplayAnalysisInput): Promise<ScreenplayAnalysisValidationReport>;
  writeScreenplayAnalysis(input: WriteScreenplayAnalysisInput): Promise<ScreenplayAnalysisWriteReport>;
  setActiveScreenplayAnalysis(input: SetActiveScreenplayAnalysisInput): Promise<ScreenplayAnalysisWriteReport>;
  readSceneBeatSheetContext(input: ReadSceneBeatSheetContextInput): Promise<SceneBeatSheetContextReport>;
  listSceneBeatSheets(input: ListSceneBeatSheetsInput): Promise<SceneBeatSheetListReport>;
  readSceneBeatSheet(input: ReadSceneBeatSheetInput): Promise<SceneBeatSheetReadReport>;
  validateSceneBeatSheet(input: ValidateSceneBeatSheetInput): Promise<SceneBeatSheetValidationReport>;
  writeSceneBeatSheet(input: WriteSceneBeatSheetInput): Promise<SceneBeatSheetWriteReport>;
  setActiveSceneBeatSheet(input: SetActiveSceneBeatSheetInput): Promise<SceneBeatSheetWriteReport>;
  validateSceneBeatSheetOperations(input: ApplySceneBeatSheetOperationsInput): Promise<SceneBeatSheetApplyReport>;
  applySceneBeatSheetOperations(input: ApplySceneBeatSheetOperationsInput): Promise<SceneBeatSheetApplyReport>;
  readSceneBeatSheetStoryboardStatus(input: ReadSceneBeatSheetStoryboardStatusInput): Promise<SceneBeatSheetStoryboardStatus>;
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
  readProjectLookbooks(input: ReadProjectLookbooksInput): Promise<ProjectLookbooksResource>;
  readProductionLookbook(input: ReadLookbookByKindInput): Promise<LookbookResource>;
  readStoryboardLookbook(input: ReadLookbookByKindInput): Promise<LookbookResource>;
  validateProductionLookbook(input: ValidateProductionLookbookInput): Promise<LookbookValidationReport>;
  validateStoryboardLookbook(input: ValidateStoryboardLookbookInput): Promise<LookbookValidationReport>;
  writeProductionLookbook(input: WriteProductionLookbookInput): Promise<LookbookWriteReport>;
  writeStoryboardLookbook(input: WriteStoryboardLookbookInput): Promise<LookbookWriteReport>;
  setLookbookSourceInspirations(input: SetLookbookSourceInspirationsInput): Promise<LookbookWriteReport>;
  listLookbookSourceInspirations(input: ListLookbookSourceInspirationsInput): Promise<LookbookSourceInspirationsReport>;
  deleteLookbookImage(input: DeleteLookbookImageInput): Promise<LookbookImageMutationReport>;
  deleteLookbookSheet(input: DeleteLookbookSheetInput): Promise<LookbookSheetMutationReport>;
  setLookbookImagePlacement(input: SetLookbookImagePlacementInput): Promise<LookbookImageMutationReport>;
}

export interface CreateMovieProjectInput extends RenkuConfigPathOptions {
  projectName: string;
  title: string;
  aspectRatio?: string;
  logline?: string;
  synopsis?: string;
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

export interface ReadPropInput extends RenkuConfigPathOptions {
  propId: string;
}

export interface ReadPropContextInput extends RenkuConfigPathOptions {
  propId: string;
}

export interface ValidatePropOperationsInput extends RenkuConfigPathOptions {
  document: PropOperationDocument;
  filePath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ApplyPropOperationsInput extends ValidatePropOperationsInput {
  dryRun?: boolean;
}

export interface ListPropDesignsInput extends RenkuConfigPathOptions {
  propId: string;
}

export interface ReadPropDesignInput extends RenkuConfigPathOptions {
  propId?: string;
  designId?: string;
  active?: boolean;
}

export interface ValidatePropDesignInput extends RenkuConfigPathOptions {
  document: PropDesignDocument;
  filePath?: string;
}

export interface WritePropDesignInput extends ValidatePropDesignInput {
  idGenerator?: ProjectIdGenerator;
}

export interface SetActivePropDesignInput extends RenkuConfigPathOptions {
  propId: string;
  designId: string;
}

export interface ScreenplayProjectInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface ReadScreenplaySectionInput extends ScreenplayProjectInput {
  sectionId: string;
}

export interface ReadScreenplaySceneInput extends ScreenplayProjectInput {
  sceneId: string;
}

export interface ResolveSceneProductionNumberInput extends ScreenplayProjectInput {
  productionNumber: string;
}

export interface CreateScreenplayInput extends ScreenplayProjectInput {
  screenplay: ScreenplayInput;
  idGenerator?: ProjectIdGenerator;
}

export interface ApplyScreenplayOperationsInput extends ScreenplayProjectInput {
  operations: ScreenplayOperationsInput['operations'];
  idGenerator?: ProjectIdGenerator;
}

export interface ReadScreenplayRevisionInput extends ScreenplayProjectInput {
  revisionId: string;
}

export interface RestoreScreenplayRevisionInput extends ScreenplayProjectInput {
  revisionId: string;
}

export interface ScreenplayAnalysisProjectInput extends RenkuConfigPathOptions {}

export interface ReadScreenplayAnalysisInput extends ScreenplayAnalysisProjectInput {
  active?: boolean;
  analysisId?: string;
}

export interface ValidateScreenplayAnalysisInput extends ScreenplayAnalysisProjectInput {
  analysis: ScreenplayAnalysis;
  filePath?: string;
}

export interface WriteScreenplayAnalysisInput extends ValidateScreenplayAnalysisInput {
  idGenerator?: ProjectIdGenerator;
}

export interface SetActiveScreenplayAnalysisInput extends ScreenplayAnalysisProjectInput {
  analysisId: string;
}

export interface SceneBeatSheetProjectInput extends RenkuConfigPathOptions {}

export interface ReadSceneBeatSheetContextInput extends SceneBeatSheetProjectInput {
  sceneId: string;
  includeVisualReferences?: boolean;
}

export interface ListSceneBeatSheetsInput extends SceneBeatSheetProjectInput {
  sceneId: string;
}

export interface ReadSceneBeatSheetInput extends SceneBeatSheetProjectInput {
  active?: boolean;
  sceneId?: string;
  beatSheetId?: string;
}

export interface ValidateSceneBeatSheetInput extends SceneBeatSheetProjectInput {
  document: SceneBeatSheetDocument;
  filePath?: string;
}

export interface WriteSceneBeatSheetInput extends ValidateSceneBeatSheetInput {
  idGenerator?: ProjectIdGenerator;
}

export interface SetActiveSceneBeatSheetInput extends SceneBeatSheetProjectInput {
  sceneId: string;
  beatSheetId: string;
}

export interface ApplySceneBeatSheetOperationsInput
  extends SceneBeatSheetProjectInput {
  document: SceneBeatSheetOperationDocument;
  filePath?: string;
  dryRun?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface ReadSceneBeatSheetStoryboardStatusInput
  extends SceneBeatSheetProjectInput {
  sceneId: string;
  beatSheetId: string;
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

export interface ReadProjectLookbooksInput extends VisualLanguageProjectInput {}

export interface ReadLookbookByKindInput extends VisualLanguageProjectInput {}

export interface ValidateProductionLookbookInput extends VisualLanguageProjectInput {
  document: ProductionLookbookDocument;
  filePath?: string;
}

export interface ValidateStoryboardLookbookInput extends VisualLanguageProjectInput {
  document: StoryboardLookbookDocument;
  filePath?: string;
}

export interface WriteProductionLookbookInput extends ValidateProductionLookbookInput {
  idGenerator?: ProjectIdGenerator;
}

export interface WriteStoryboardLookbookInput extends ValidateStoryboardLookbookInput {
  idGenerator?: ProjectIdGenerator;
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
  owner: AssetOwner;
  locale?: AssetLocaleContext;
  type?: string;
  mediaKind?: string;
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

export interface ReadPropResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  propId: string;
}

export interface ReadSceneNarrativeResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  sceneId: string;
}

export interface ReadSceneBeatSheetResourceInput extends RenkuConfigPathOptions {
  projectName: string;
  sceneId: string;
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
  synopsis?: string | null;
  premise?: string | null;
  intendedAudience?: string | null;
  format?: string | null;
  targetRuntimeMinutes?: number | null;
  primaryGenre?: string | null;
  secondaryGenres?: string[] | null;
  tones?: string[] | null;
  contentRatingIntent?: string | null;
  creativeBoundaries?: string[] | null;
  centralConflict?: string | null;
  dramaticQuestion?: string | null;
  themes?: string[] | null;
  historicalBasis?: string[] | null;
  dramatizedElements?: string[] | null;
  screenplayDraftStatus?: string | null;
  researchSources?: string[] | null;
  assumptions?: string[] | null;
  openQuestions?: string[] | null;
  nextSteps?: string[] | null;
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
  synopsis?: string;
  premise?: string;
  intendedAudience?: string;
  format?: string;
  targetRuntimeMinutes?: number;
  primaryGenre?: string;
  secondaryGenres?: string[];
  tones?: string[];
  contentRatingIntent?: string;
  creativeBoundaries?: string[];
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
  dramatizedElements?: string[];
  screenplayDraftStatus?: string;
  researchSources?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  nextSteps?: string[];
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
  owner: AssetOwner;
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
  owner: AssetOwner;
  locale?: AssetLocaleContext;
  type?: string;
  mediaKind?: string;
}

export interface DiscardAssetInput extends RenkuConfigPathOptions {
  projectName: string;
  owner: AssetOwner;
  assetId: string;
}

export interface RestoreAssetInput extends RenkuConfigPathOptions {
  projectName: string;
  assetId: string;
}
