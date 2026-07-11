import type {
  AgentMediaReport,
  CastCharacterSheetGenerationContext,
  CastCharacterSheetModelListReport,
  CastMediaImportReport,
  CastProfileGenerationContext,
  CastProfileModelListReport,
  CastVoiceSampleGenerationContext,
  CastVoiceSampleModelListReport,
  GenerationPreviewRequest,
  ImageCreateGenerationContext,
  ImageCreateModelListReport,
  ImageEditGenerationContext,
  ImageEditModelListReport,
  LocationEnvironmentSheetGenerationContext,
  LocationEnvironmentSheetMediaImportReport,
  LocationEnvironmentSheetModelListReport,
  LocationHeroGenerationContext,
  LocationHeroMediaImportReport,
  LocationHeroModelListReport,
  LookbookImageGenerationContext,
  LookbookImageMediaImportReport,
  LookbookImageModelListReport,
  LookbookSheetGenerationContext,
  LookbookSheetMediaImportReport,
  LookbookSheetModelListReport,
  MediaGenerationCostProjection,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencySlot,
  MediaGenerationPurpose,
  MediaGenerationRequestTarget,
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
  MediaGenerationTarget,
  MediaKind,
  PreparedMediaGeneration,
  ImageRevisionDraft,
  SceneDialogueAudioContext,
  SceneDialogueAudioModelListReport,
  SceneStoryboardImagesImportReport,
  SceneStoryboardSheetGenerationContext,
  SceneStoryboardSheetModelListReport,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeMediaImportReport,
  ShotVideoTakeModelListReport,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import type {
  GenerationPreviewPromptUpdate,
  GenerationPreviewReferenceSelectionUpdate,
} from '../../generation-preview/contracts.js';
import type { ProjectIdGenerator } from '../../entity-ids.js';
import type {
  ReadMediaGenerationSpecInput,
  RunMediaGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import type {
  MediaGenerationDependencyDraftPlan,
  MediaGenerationDependencyDraftSpecInput,
} from '../dependencies/dependency-draft-specs.js';

export type MediaGenerationContextReport =
  | ImageCreateGenerationContext
  | ImageEditGenerationContext
  | LookbookImageGenerationContext
  | LookbookSheetGenerationContext
  | CastCharacterSheetGenerationContext
  | CastProfileGenerationContext
  | CastVoiceSampleGenerationContext
  | SceneDialogueAudioContext
  | LocationEnvironmentSheetGenerationContext
  | LocationHeroGenerationContext
  | SceneStoryboardSheetGenerationContext
  | ShotVideoTakeProductionContext;

export type AgentAwareMediaGenerationContextReport =
  MediaGenerationContextReport & { agentMedia?: AgentMediaReport };

export type MediaGenerationModelListReport =
  | ImageCreateModelListReport
  | ImageEditModelListReport
  | LookbookImageModelListReport
  | LookbookSheetModelListReport
  | CastCharacterSheetModelListReport
  | CastProfileModelListReport
  | CastVoiceSampleModelListReport
  | SceneDialogueAudioModelListReport
  | LocationEnvironmentSheetModelListReport
  | LocationHeroModelListReport
  | SceneStoryboardSheetModelListReport
  | ShotVideoTakeModelListReport;

export type AgentAwareMediaGenerationModelListReport =
  MediaGenerationModelListReport & { agentMedia?: AgentMediaReport };

export type MediaGenerationImportReport =
  | LookbookImageMediaImportReport
  | LookbookSheetMediaImportReport
  | CastMediaImportReport
  | LocationEnvironmentSheetMediaImportReport
  | LocationHeroMediaImportReport
  | SceneStoryboardImagesImportReport
  | ShotVideoTakeInputMediaImportReport
  | ShotVideoTakeMediaImportReport;

export interface MediaGenerationPurposeContextInput {
  projectName?: string;
  homeDir?: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationRequestTarget;
  shotListId?: string;
  shotIds?: string[];
  inputModeId?: string;
}

export interface ListMediaGenerationSpecsInput {
  projectName?: string;
  homeDir?: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationRequestTarget;
  shotListId?: string;
  shotIds?: string[];
}

export interface ValidateMediaGenerationSpecInput {
  projectName?: string;
  homeDir?: string;
  spec: MediaGenerationSpec;
}

export interface PrepareDraftMediaGenerationSpecInput
  extends ValidateMediaGenerationSpecInput {}

export interface MediaGenerationCostProjectionInput
  extends ValidateMediaGenerationSpecInput {}

export interface CreateMediaGenerationSpecInput
  extends ValidateMediaGenerationSpecInput {
  idGenerator?: ProjectIdGenerator;
}

export interface UpdateMediaGenerationSpecInput
  extends ValidateMediaGenerationSpecInput {
  specId: string;
}

export interface MediaGenerationDependencyDeclarationInput {
  projectName?: string;
  homeDir?: string;
  rootPurpose: MediaGenerationPurpose;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  request: MediaGenerationDependencyRequest;
  parentLineId?: string;
}

export interface MediaGenerationPreviewBuildInput {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}

export interface ApplyMediaGenerationPreviewUpdateInput
  extends MediaGenerationPreviewBuildInput {
  prompt: GenerationPreviewPromptUpdate;
  referenceSelections: GenerationPreviewReferenceSelectionUpdate[];
}

export interface MediaGenerationPurposePreview {
  build(
    input: MediaGenerationPreviewBuildInput,
  ): Promise<GenerationPreviewRequest>;
  update?(
    input: ApplyMediaGenerationPreviewUpdateInput,
  ): Promise<MediaGenerationSpecRecord>;
}

export interface MediaGenerationPurposeImageRegeneration {
  applyEditor(input: {
    projectName?: string;
    homeDir?: string;
    spec: MediaGenerationSpec;
    draft: ImageRevisionDraft;
  }): Promise<MediaGenerationSpec>;
}

export interface MediaGenerationPurposeDefinition {
  purpose: MediaGenerationPurpose;
  mediaKind: MediaKind;
  targetKind: MediaGenerationRequestTarget['kind'];
  buildCostProjection(
    input: MediaGenerationCostProjectionInput,
  ): Promise<MediaGenerationCostProjection>;
  buildContext(
    input: MediaGenerationPurposeContextInput,
  ): Promise<MediaGenerationContextReport>;
  listModels(
    input: MediaGenerationPurposeContextInput,
  ): Promise<MediaGenerationModelListReport>;
  validateSpec(
    input: ValidateMediaGenerationSpecInput,
  ): Promise<{
    valid: true;
    spec: MediaGenerationSpec;
    providerPayload: Record<string, unknown>;
  }>;
  createSpec(
    input: CreateMediaGenerationSpecInput,
  ): Promise<MediaGenerationSpecRecord>;
  updateSpec(
    input: UpdateMediaGenerationSpecInput,
  ): Promise<MediaGenerationSpecRecord>;
  listSpecs(
    input: ListMediaGenerationSpecsInput,
  ): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  prepareDraftSpec(
    input: PrepareDraftMediaGenerationSpecInput,
  ): Promise<PreparedMediaGeneration>;
  preview?: MediaGenerationPurposePreview;
  imageRegeneration?: MediaGenerationPurposeImageRegeneration;
  declareDependencies?(
    input: MediaGenerationDependencyDeclarationInput,
  ): Promise<MediaGenerationDependencySlot[]>;
  planDependencyDraft?(
    input: MediaGenerationDependencyDraftSpecInput,
  ): Promise<MediaGenerationDependencyDraftPlan>;
  runSpec(input: RunMediaGenerationSpecInput): Promise<unknown>;
}
