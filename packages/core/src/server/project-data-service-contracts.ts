import type {
  Asset,
  AssetLocaleContext,
  AssetTarget,
  ActNavigationRow,
  CastMemberResource,
  CastOverviewResource,
  CastDesignResource,
  CastNavigationRow,
  InspirationAnalysisValidationReport,
  InspirationAnalysisWriteReport,
  InspirationFolder,
  InspirationFolderReport,
  InspirationFolderResource,
  InspirationResource,
  LookbookImageMutationReport,
  LookbookImageGenerationContext,
  LookbookImageGenerationSpec,
  LookbookImageMediaImportReport,
  LookbookImageModelListReport,
  LookbookResource,
  LookbookSourceInspirationsReport,
  LookbooksResource,
  LookbookSection,
  LookbookValidationReport,
  LookbookWriteReport,
  LocationNavigationRow,
  LocationOverviewResource,
  LocationResource,
  CastCharacterSheetGenerationContext,
  CastCharacterSheetGenerationSpec,
  CastCharacterSheetModelListReport,
  CastMediaImportReport,
  CastProfileGenerationContext,
  CastProfileGenerationSpec,
  CastProfileModelListReport,
  LocationEnvironmentSheetGenerationContext,
  LocationEnvironmentSheetGenerationSpec,
  LocationEnvironmentSheetMediaImportReport,
  LocationEnvironmentSheetModelListReport,
  SceneStoryboardSheetGenerationContext,
  SceneStoryboardSheetGenerationSpec,
  SceneStoryboardSheetModelListReport,
  ShotVideoTakeAvailableInput,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeMediaImportReport,
  ShotVideoTakeModelListReport,
  ShotVideoTakePreflightReport,
  MediaGenerationEstimateReport,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  SceneDesignResource,
  SceneNarrativeResource,
  ScreenplayAnalysisContextReport,
  ScreenplayAnalysisDocument,
  ScreenplayAnalysisListReport,
  ScreenplayAnalysisReadReport,
  ScreenplayAnalysisValidationReport,
  ScreenplayAnalysisWriteReport,
  SceneShotListContextReport,
  SceneShotListDocument,
  SceneShotListListReport,
  SceneShotListReadReport,
  SceneShotListValidationReport,
  SceneShotListWriteReport,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeIntentId,
  ShotVideoTakeProductionPlan,
  SceneStoryboardSheetImportDocument,
  SceneStoryboardSheetImportReport,
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
  SequenceResource,
  StoryArcResource,
  ActStoryboardResource,
  SceneShotListResource,
  ShotSpecs,
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
  ScreenplayStatusReport,
  Sequence as ScreenplaySequence,
} from '../client/screenplay.js';
import type { CurrentProjectReport } from './database/lifecycle/current-project.js';
import type { RenkuConfigPathOptions } from './renku-config.js';
import type { ProjectIdGenerator } from './entity-ids.js';

export interface ProjectDataService {
  createMovieProject(input: CreateMovieProjectInput): Promise<ProjectCreateReport>;
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
  updateSceneShotSpecs(
    input: UpdateSceneShotSpecsInput
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
  registerAsset(input: RegisterAssetInput & RenkuConfigPathOptions): Promise<Asset>;
  listAssets(input: ListAssetsInput): Promise<Asset[]>;
  createAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  updateAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  removeAssetSelect(input: RemoveAssetSelectInput): Promise<Asset>;
  deleteAsset(input: DeleteAssetInput): Promise<void>;
  listAssetSelects(input: ListAssetsInput): Promise<Asset[]>;
  exportProductionAssets(
    input: ProductionExportInput & RenkuConfigPathOptions
  ): Promise<ProductionExportSummary>;
  openCurrentProject(input: OpenCurrentProjectInput): Promise<CurrentProjectReport>;
  readCurrentProject(input?: RenkuConfigPathOptions): Promise<CurrentProjectReport | null>;
  closeCurrentProject(input?: RenkuConfigPathOptions): Promise<CurrentProjectReport | null>;
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
  listInspirationFolders(input: ListInspirationFoldersInput): Promise<PageResponse<InspirationFolder>>;
  readInspirationResource(input: ListInspirationFoldersInput): Promise<InspirationResource>;
  readInspirationFolder(input: ReadInspirationFolderInput): Promise<InspirationFolderResource>;
  createInspirationFolder(input: CreateInspirationFolderInput): Promise<InspirationFolder>;
  renameInspirationFolder(input: RenameInspirationFolderInput): Promise<InspirationFolder>;
  reorderInspirationFolders(input: ReorderInspirationFoldersInput): Promise<PageResponse<InspirationFolder>>;
  deleteInspirationFolder(input: DeleteInspirationFolderInput): Promise<void>;
  writeInspirationImage(input: WriteInspirationImageInput): Promise<InspirationFolderResource>;
  deleteInspirationImage(input: DeleteInspirationImageInput): Promise<InspirationFolderResource>;
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
  setActiveLookbook(input: SetActiveLookbookInput): Promise<VisualLanguageCommandReport>;
  clearActiveLookbook(input: ClearActiveLookbookInput): Promise<VisualLanguageCommandReport>;
  setLookbookSourceInspirations(input: SetLookbookSourceInspirationsInput): Promise<LookbookWriteReport>;
  listLookbookSourceInspirations(input: ListLookbookSourceInspirationsInput): Promise<LookbookSourceInspirationsReport>;
  setLookbookCardImage(input: SetLookbookCardImageInput): Promise<LookbookImageMutationReport>;
  clearLookbookCardImage(input: ClearLookbookCardImageInput): Promise<LookbookImageMutationReport>;
  deleteLookbookImage(input: DeleteLookbookImageInput): Promise<LookbookImageMutationReport>;
  setLookbookImageSections(input: SetLookbookImageSectionsInput): Promise<LookbookImageMutationReport>;
  buildLookbookImageContext(input: ReadLookbookImageGenerationContextInput): Promise<LookbookImageGenerationContext>;
  listLookbookImageModels(input: ReadLookbookImageGenerationContextInput): Promise<LookbookImageModelListReport>;
  validateLookbookImageSpec(input: ValidateLookbookImageGenerationSpecInput): Promise<{ valid: true; spec: LookbookImageGenerationSpec; providerPayload: Record<string, unknown> }>;
  createLookbookImageSpec(input: CreateLookbookImageGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateLookbookImageSpec(input: UpdateLookbookImageGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readLookbookImageSpec(input: ReadLookbookImageGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listLookbookImageSpecs(input: ReadLookbookImageGenerationContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareLookbookImageSpec(input: ReadLookbookImageGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateLookbookImageSpec(input: ReadLookbookImageGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runLookbookImageSpec(input: RunLookbookImageGenerationSpecInput): Promise<MediaGenerationRunReport>;
  recordLookbookImageRun(input: RecordLookbookImageGenerationRunInput): Promise<MediaGenerationRunReport>;
  importLookbookImageMedia(input: ImportLookbookImageMediaInput): Promise<LookbookImageMediaImportReport>;
  buildCastCharacterSheetContext(input: CastMediaGenerationContextInput): Promise<CastCharacterSheetGenerationContext>;
  listCastCharacterSheetModels(input: CastMediaGenerationContextInput): Promise<CastCharacterSheetModelListReport>;
  validateCastCharacterSheetSpec(input: ValidateCastCharacterSheetGenerationSpecInput): Promise<{ valid: true; spec: CastCharacterSheetGenerationSpec; providerPayload: Record<string, unknown> }>;
  createCastCharacterSheetSpec(input: CreateCastCharacterSheetGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateCastCharacterSheetSpec(input: UpdateCastCharacterSheetGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readCastCharacterSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listCastCharacterSheetSpecs(input: CastMediaGenerationContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareCastCharacterSheetSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateCastCharacterSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runCastCharacterSheetSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  recordCastCharacterSheetRun(input: RecordMediaGenerationRunInput): Promise<MediaGenerationRunReport>;
  importCastCharacterSheetMedia(input: ImportCastMediaInput): Promise<CastMediaImportReport>;
  buildCastProfileContext(input: CastMediaGenerationContextInput): Promise<CastProfileGenerationContext>;
  listCastProfileModels(input: CastMediaGenerationContextInput): Promise<CastProfileModelListReport>;
  validateCastProfileSpec(input: ValidateCastProfileGenerationSpecInput): Promise<{ valid: true; spec: CastProfileGenerationSpec; providerPayload: Record<string, unknown> }>;
  createCastProfileSpec(input: CreateCastProfileGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateCastProfileSpec(input: UpdateCastProfileGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readCastProfileSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listCastProfileSpecs(input: CastMediaGenerationContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareCastProfileSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateCastProfileSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runCastProfileSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  recordCastProfileRun(input: RecordMediaGenerationRunInput): Promise<MediaGenerationRunReport>;
  importCastProfileMedia(input: ImportCastMediaInput): Promise<CastMediaImportReport>;
  buildLocationEnvironmentSheetContext(input: LocationMediaGenerationContextInput): Promise<LocationEnvironmentSheetGenerationContext>;
  listLocationEnvironmentSheetModels(input: LocationMediaGenerationContextInput): Promise<LocationEnvironmentSheetModelListReport>;
  validateLocationEnvironmentSheetSpec(input: ValidateLocationEnvironmentSheetGenerationSpecInput): Promise<{ valid: true; spec: LocationEnvironmentSheetGenerationSpec; providerPayload: Record<string, unknown> }>;
  createLocationEnvironmentSheetSpec(input: CreateLocationEnvironmentSheetGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateLocationEnvironmentSheetSpec(input: UpdateLocationEnvironmentSheetGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readLocationEnvironmentSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listLocationEnvironmentSheetSpecs(input: LocationMediaGenerationContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareLocationEnvironmentSheetSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateLocationEnvironmentSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runLocationEnvironmentSheetSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  recordLocationEnvironmentSheetRun(input: RecordMediaGenerationRunInput): Promise<MediaGenerationRunReport>;
  importLocationEnvironmentSheetMedia(input: ImportLocationEnvironmentSheetMediaInput): Promise<LocationEnvironmentSheetMediaImportReport>;
  buildSceneStoryboardSheetContext(input: ReadSceneStoryboardSheetGenerationContextInput): Promise<SceneStoryboardSheetGenerationContext>;
  listSceneStoryboardSheetModels(input: ReadSceneStoryboardSheetGenerationContextInput): Promise<SceneStoryboardSheetModelListReport>;
  validateSceneStoryboardSheetSpec(input: ValidateSceneStoryboardSheetGenerationSpecInput): Promise<{ valid: true; spec: SceneStoryboardSheetGenerationSpec; providerPayload: Record<string, unknown> }>;
  createSceneStoryboardSheetSpec(input: CreateSceneStoryboardSheetGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateSceneStoryboardSheetSpec(input: UpdateSceneStoryboardSheetGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readSceneStoryboardSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listSceneStoryboardSheetSpecs(input: ReadSceneStoryboardSheetGenerationContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareSceneStoryboardSheetSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateSceneStoryboardSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runSceneStoryboardSheetSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  recordSceneStoryboardSheetRun(input: RecordMediaGenerationRunInput): Promise<MediaGenerationRunReport>;
  importSceneStoryboardSheetMedia(input: ImportSceneStoryboardSheetMediaInput): Promise<SceneStoryboardSheetImportReport>;
  buildShotVideoTakeContext(input: ShotVideoTakeContextInput): Promise<ShotVideoTakeGenerationContext>;
  listShotVideoTakeModels(input: ShotVideoTakeModelListInput): Promise<ShotVideoTakeModelListReport>;
  listShotVideoTakeInputs(input: ShotVideoTakeContextInput): Promise<{ inputs: ShotVideoTakeAvailableInput[]; resourceKeys: string[] }>;
  updateShotVideoTakeProductionGroup(input: UpdateShotVideoTakeProductionGroupInput): Promise<ShotVideoTakeGenerationContext>;
  previewShotVideoTakeProduction(input: PreviewShotVideoTakeProductionInput): Promise<ShotVideoTakePreflightReport>;
  selectShotVideoTakeInput(input: SelectShotVideoTakeInputInput): Promise<ShotVideoTakeGenerationContext>;
  clearShotVideoTakeInputSelection(input: ClearShotVideoTakeInputSelectionInput): Promise<ShotVideoTakeGenerationContext>;
  validateShotFirstFrameSpec(input: ValidateShotVideoTakeInputGenerationSpecInput): Promise<{ valid: true; spec: ShotVideoTakeInputGenerationSpec; providerPayload: Record<string, unknown> }>;
  createShotFirstFrameSpec(input: CreateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateShotFirstFrameSpec(input: UpdateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readShotFirstFrameSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listShotFirstFrameSpecs(input: ShotVideoTakeContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareShotFirstFrameSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateShotFirstFrameSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runShotFirstFrameSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  validateShotLastFrameSpec(input: ValidateShotVideoTakeInputGenerationSpecInput): Promise<{ valid: true; spec: ShotVideoTakeInputGenerationSpec; providerPayload: Record<string, unknown> }>;
  createShotLastFrameSpec(input: CreateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateShotLastFrameSpec(input: UpdateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readShotLastFrameSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listShotLastFrameSpecs(input: ShotVideoTakeContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareShotLastFrameSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateShotLastFrameSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runShotLastFrameSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  validateShotReferenceSheetSpec(input: ValidateShotVideoTakeInputGenerationSpecInput): Promise<{ valid: true; spec: ShotVideoTakeInputGenerationSpec; providerPayload: Record<string, unknown> }>;
  createShotReferenceSheetSpec(input: CreateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateShotReferenceSheetSpec(input: UpdateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readShotReferenceSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listShotReferenceSheetSpecs(input: ShotVideoTakeContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareShotReferenceSheetSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateShotReferenceSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runShotReferenceSheetSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  validateShotMultiShotStoryboardSheetSpec(input: ValidateShotVideoTakeInputGenerationSpecInput): Promise<{ valid: true; spec: ShotVideoTakeInputGenerationSpec; providerPayload: Record<string, unknown> }>;
  createShotMultiShotStoryboardSheetSpec(input: CreateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateShotMultiShotStoryboardSheetSpec(input: UpdateShotVideoTakeInputGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readShotMultiShotStoryboardSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listShotMultiShotStoryboardSheetSpecs(input: ShotVideoTakeContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareShotMultiShotStoryboardSheetSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateShotMultiShotStoryboardSheetSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runShotMultiShotStoryboardSheetSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  validateShotVideoTakeSpec(input: ValidateShotVideoTakeGenerationSpecInput): Promise<{ valid: true; spec: ShotVideoTakeGenerationSpec; providerPayload: Record<string, unknown> }>;
  createShotVideoTakeSpec(input: CreateShotVideoTakeGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateShotVideoTakeSpec(input: UpdateShotVideoTakeGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  readShotVideoTakeSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listShotVideoTakeSpecs(input: ShotVideoTakeContextInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareShotVideoTakeSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  estimateShotVideoTakeSpec(input: ReadMediaGenerationSpecInput): Promise<MediaGenerationEstimateReport>;
  runShotVideoTakeSpec(input: RunMediaGenerationSpecInput): Promise<MediaGenerationRunReport>;
  importShotFirstFrame(input: ImportShotVideoTakeInputMediaInput): Promise<ShotVideoTakeInputMediaImportReport>;
  importShotLastFrame(input: ImportShotVideoTakeInputMediaInput): Promise<ShotVideoTakeInputMediaImportReport>;
  importShotReferenceSheet(input: ImportShotVideoTakeInputMediaInput): Promise<ShotVideoTakeInputMediaImportReport>;
  importShotMultiShotStoryboardSheet(input: ImportShotVideoTakeInputMediaInput): Promise<ShotVideoTakeInputMediaImportReport>;
  importShotVideoTake(input: ImportShotVideoTakeMediaInput): Promise<ShotVideoTakeMediaImportReport>;
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

export interface OpenCurrentProjectInput extends RenkuConfigPathOptions {
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
  document?: ScreenplayDocument | ScreenplayCreateDocument | ScreenplayOperationDocument;
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
  name: string;
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

export interface SetActiveLookbookInput extends VisualLanguageProjectInput {
  lookbookId: string;
}

export interface ClearActiveLookbookInput extends VisualLanguageProjectInput {}

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

export interface SetLookbookImageSectionsInput extends VisualLanguageProjectInput {
  imageId: string;
  sections: LookbookSection[];
  idGenerator?: ProjectIdGenerator;
}

export interface ReadLookbookImageGenerationContextInput extends RenkuConfigPathOptions {
  projectName?: string;
  lookbookId: string;
}

export interface ValidateLookbookImageGenerationSpecInput extends RenkuConfigPathOptions {
  projectName?: string;
  spec: LookbookImageGenerationSpec;
}

export interface CreateLookbookImageGenerationSpecInput
  extends ValidateLookbookImageGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateLookbookImageGenerationSpecInput
  extends ValidateLookbookImageGenerationSpecInput {
  specId: string;
}

export interface ReadLookbookImageGenerationSpecInput extends RenkuConfigPathOptions {
  projectName?: string;
  specId: string;
}

export interface RunLookbookImageGenerationSpecInput
  extends ReadLookbookImageGenerationSpecInput {
  approvalToken?: string;
  simulate?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface RecordLookbookImageGenerationRunInput
  extends ReadLookbookImageGenerationSpecInput {
  provider: 'fal-ai';
  model: string;
  providerPayload: Record<string, unknown>;
  estimate: unknown;
  approvalToken?: string;
  simulated: boolean;
  status: 'simulated' | 'completed' | 'failed';
  outputs: unknown;
  diagnostics: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface ImportLookbookImageMediaInput extends RenkuConfigPathOptions {
  projectName?: string;
  lookbookId: string;
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  sections?: string[];
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface CastMediaGenerationContextInput extends RenkuConfigPathOptions {
  projectName?: string;
  castMemberId: string;
}

export interface ValidateCastCharacterSheetGenerationSpecInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  spec: CastCharacterSheetGenerationSpec;
}

export interface CreateCastCharacterSheetGenerationSpecInput
  extends ValidateCastCharacterSheetGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateCastCharacterSheetGenerationSpecInput
  extends ValidateCastCharacterSheetGenerationSpecInput {
  specId: string;
}

export interface ValidateCastProfileGenerationSpecInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  spec: CastProfileGenerationSpec;
}

export interface CreateCastProfileGenerationSpecInput
  extends ValidateCastProfileGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateCastProfileGenerationSpecInput
  extends ValidateCastProfileGenerationSpecInput {
  specId: string;
}

export interface ReadMediaGenerationSpecInput extends RenkuConfigPathOptions {
  projectName?: string;
  specId: string;
}

export interface RunMediaGenerationSpecInput
  extends ReadMediaGenerationSpecInput {
  approvalToken?: string;
  simulate?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface RecordMediaGenerationRunInput
  extends ReadMediaGenerationSpecInput {
  provider: 'fal-ai';
  model: string;
  providerPayload: Record<string, unknown>;
  estimate: unknown;
  approvalToken?: string;
  simulated: boolean;
  status: 'simulated' | 'completed' | 'failed';
  outputs: unknown;
  diagnostics: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface ImportCastMediaInput extends RenkuConfigPathOptions {
  projectName?: string;
  castMemberId: string;
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface LocationMediaGenerationContextInput extends RenkuConfigPathOptions {
  projectName?: string;
  locationId: string;
}

export interface ValidateLocationEnvironmentSheetGenerationSpecInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  spec: LocationEnvironmentSheetGenerationSpec;
}

export interface CreateLocationEnvironmentSheetGenerationSpecInput
  extends ValidateLocationEnvironmentSheetGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateLocationEnvironmentSheetGenerationSpecInput
  extends ValidateLocationEnvironmentSheetGenerationSpecInput {
  specId: string;
}

export interface ImportLocationEnvironmentSheetMediaInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  locationId: string;
  files: {
    composite: string;
    view_front: string;
    view_right: string;
    view_back: string;
    view_left: string;
  };
  title?: string;
  oneLineSummary?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ReadSceneStoryboardSheetGenerationContextInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  sceneId: string;
  shotListId: string;
}

export interface ValidateSceneStoryboardSheetGenerationSpecInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  spec: SceneStoryboardSheetGenerationSpec;
}

export interface CreateSceneStoryboardSheetGenerationSpecInput
  extends ValidateSceneStoryboardSheetGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateSceneStoryboardSheetGenerationSpecInput
  extends ValidateSceneStoryboardSheetGenerationSpecInput {
  specId: string;
}

export interface ImportSceneStoryboardSheetMediaInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  sceneId: string;
  shotListId: string;
  document: SceneStoryboardSheetImportDocument;
  title?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ShotVideoTakeContextInput extends RenkuConfigPathOptions {
  projectName?: string;
  sceneId: string;
  shotListId: string;
  shotIds: string[];
  productionGroupId?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ShotVideoTakeModelListInput extends ShotVideoTakeContextInput {
  intentId?: ShotVideoTakeIntentId;
}

export interface UpdateShotVideoTakeProductionGroupInput
  extends ShotVideoTakeContextInput {
  production: ShotVideoTakeProductionPlan;
}

export interface PreviewShotVideoTakeProductionInput
  extends ShotVideoTakeContextInput {
  production?: ShotVideoTakeProductionPlan;
}

export interface SelectShotVideoTakeInputInput
  extends ShotVideoTakeContextInput {
  inputId: string;
}

export interface ClearShotVideoTakeInputSelectionInput
  extends ShotVideoTakeContextInput {
  kind: ShotVideoTakeInputKind;
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
}

export interface ValidateShotVideoTakeInputGenerationSpecInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  spec: ShotVideoTakeInputGenerationSpec;
}

export interface CreateShotVideoTakeInputGenerationSpecInput
  extends ValidateShotVideoTakeInputGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateShotVideoTakeInputGenerationSpecInput
  extends ValidateShotVideoTakeInputGenerationSpecInput {
  specId: string;
}

export interface ValidateShotVideoTakeGenerationSpecInput
  extends RenkuConfigPathOptions {
  projectName?: string;
  spec: ShotVideoTakeGenerationSpec;
}

export interface CreateShotVideoTakeGenerationSpecInput
  extends ValidateShotVideoTakeGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateShotVideoTakeGenerationSpecInput
  extends ValidateShotVideoTakeGenerationSpecInput {
  specId: string;
}

export interface ImportShotVideoTakeInputMediaInput
  extends ShotVideoTakeContextInput {
  sourceProjectRelativePath: string;
  title?: string;
  receipt?: unknown;
  selection?: 'select' | 'take';
}

export interface ImportShotVideoTakeMediaInput extends ShotVideoTakeContextInput {
  sourceProjectRelativePath: string;
  title?: string;
  receipt?: unknown;
  isSelected?: boolean;
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

export interface UpdateSceneShotSpecsInput
  extends RenkuConfigPathOptions {
  projectName: string;
  sceneId: string;
  shotId: string;
  /** Full structured selection for the shot, or null to clear it. */
  shotSpecs: ShotSpecs | null;
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

export interface DeleteAssetInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
}
