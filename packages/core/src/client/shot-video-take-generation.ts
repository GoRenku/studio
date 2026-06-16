import type { GenerationEstimate } from '@gorenku/studio-engines';
import type { Asset } from './assets.js';
import type { ProjectRelativePath } from './project.js';
import type { SceneSetting } from './screenplay.js';
import type { SceneShot, LocationAzimuthViewId, ShotVideoTakePromptDraft, ShotVideoTakeDependencyKind, ShotVideoTakeInputKind, ShotVideoTakeInputSubjectKind, ShotVideoTakeInputModeId, ShotVideoTakeShotGroupMode, ShotVideoTakeModelChoice, ShotVideoTakeParameterValues, ShotVideoTakeProductionGroup } from './scene-shot-list.js';
import type { MediaGenerationDependencyKind, MediaGenerationDependencyInventory, MediaGenerationDependencyPricing, MediaGenerationPlanLine } from './media-generation-dependency.js';
import type { MediaGenerationPurpose, MediaKind } from './media-generation-purpose.js';
import type { SceneShotMediaGenerationTarget } from './media-generation-target.js';
import { SHOT_FIRST_FRAME_GENERATION_PURPOSE, SHOT_LAST_FRAME_GENERATION_PURPOSE, SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE, SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE, SHOT_VIDEO_TAKE_GENERATION_PURPOSE } from './media-generation-purpose.js';

export type ShotVideoTakeInputModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type ShotVideoTakeInputGenerationPurpose =
  | typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_LAST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE
  | typeof SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE;

export interface ShotVideoTakeProjectContext {
  id?: string;
  name: string;
  title: string;
  aspectRatio: string | null;
}

export interface ShotVideoTakeSceneContext {
  id: string;
  title: string;
  setting: SceneSetting;
  storyFunction: string[];
}

export interface ShotVideoTakeShotListContext {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ShotVideoTakeCastReference {
  id: string;
  handle: string;
  name: string;
  role?: string;
  isVoiceOver: boolean;
  description?: string;
}

export interface ShotVideoTakeLocationReference {
  id: string;
  handle: string;
  name: string;
  description?: string;
}

export interface ShotVideoTakeLookbookReference {
  id: string;
  name: string;
  thesis: string;
}

export interface ShotVideoTakeStoryboardImageReference {
  shotId: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
}

export interface ShotVideoTakeAvailableInput {
  inputId: string;
  kind: ShotVideoTakeInputKind;
  title: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image' | 'audio' | 'video';
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
  productionGroupId?: string;
  shotIds: string[];
  mediaGenerationRunId?: string;
  selected: boolean;
  createdAt: string;
}

export interface SceneShotVideoTake {
  takeId: string;
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId?: string;
  shotIds: string[];
  selected: boolean;
  createdAt: string;
}

export interface ShotVideoTakeDefaults {
  inputModeId: ShotVideoTakeInputModeId;
  imageDependencyModelChoice: ShotVideoTakeInputModelChoice;
  parameterValues: ShotVideoTakeParameterValues;
}

export interface ShotVideoTakeGenerationContext {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  project: ShotVideoTakeProjectContext;
  scene: ShotVideoTakeSceneContext;
  shotList: ShotVideoTakeShotListContext;
  productionGroup: ShotVideoTakeProductionGroup;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  shots: SceneShot[];
  referencedCast: ShotVideoTakeCastReference[];
  referencedLocations: ShotVideoTakeLocationReference[];
  activeLookbook: ShotVideoTakeLookbookReference | null;
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
  availableInputs: ShotVideoTakeAvailableInput[];
  existingTakes: SceneShotVideoTake[];
  defaults: ShotVideoTakeDefaults;
  resourceKeys: string[];
}

export interface ShotVideoTakeInputGenerationSpec {
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotMediaGenerationTarget;
  planId?: string;
  dependencyKind: ShotVideoTakeDependencyKind;
  outputInputKind: ShotVideoTakeInputKind;
  modelChoice: ShotVideoTakeInputModelChoice;
  prompt: string;
  parameterValues: ShotVideoTakeParameterValues;
  title?: string;
}

export interface ShotVideoTakeGenerationInput {
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId: string;
  role: string;
  mediaKind: 'image' | 'audio' | 'video';
  projectRelativePath: ProjectRelativePath;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  providerReferenceRole?:
    | 'top-level-image'
    | 'element-frontal-image'
    | 'element-reference-image'
    | 'element-video'
    | 'source-video'
    | 'audio-reference';
  elementId?: string;
  seedanceAudioReferenceIntent?: 'clean-voice-sample' | 'generated-dialogue-reference';
}

export interface ShotVideoTakeGenerationSpec {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  planId?: string;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  prompt: string;
  negativePrompt?: string;
  parameterValues: ShotVideoTakeParameterValues;
  inputs: ShotVideoTakeGenerationInput[];
  title?: string;
}

export interface ShotVideoTakeDurationSupport {
  supported: boolean;
  values?: number[];
  minimum?: number;
  maximum?: number;
  default?: number;
}

export interface ShotVideoTakeModelInputRoleReport {
  kind: ShotVideoTakeInputKind;
  required: boolean;
  minCount: number;
  maxCount: number | null;
  mediaKind: 'image' | 'audio' | 'video';
}

export interface ShotVideoTakeParameterReport {
  name: string;
  label: string;
  required: boolean;
  defaultValue?: import('./scene-shot-list.js').ShotVideoTakeParameterValue;
  allowedValues?: import('./scene-shot-list.js').ShotVideoTakeParameterValue[];
  minimum?: number;
  maximum?: number;
}

export interface ShotVideoTakeEstimateInputReport {
  canEstimateBeforeDependenciesExist: boolean;
  requiresPreparedInputs: boolean;
}

export interface ShotVideoTakeModelChoiceReport {
  modelChoice: ShotVideoTakeModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportedInputModes: ShotVideoTakeInputModeId[];
  duration: ShotVideoTakeDurationSupport;
  inputRoles: ShotVideoTakeModelInputRoleReport[];
  parameters: ShotVideoTakeParameterReport[];
  estimateInputs: ShotVideoTakeEstimateInputReport;
}

export interface ShotVideoTakeModelListReport {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  inputModeId?: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  defaultModelChoice: ShotVideoTakeModelChoice;
  models: ShotVideoTakeModelChoiceReport[];
}

export interface ShotVideoTakeInputModelChoiceReport {
  modelChoice: ShotVideoTakeInputModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  mediaKind: 'image';
  defaultParameterValues: ShotVideoTakeParameterValues;
  parameters: ShotVideoTakeParameterReport[];
}

export interface ShotVideoTakeInputModelListReport {
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotMediaGenerationTarget;
  defaultModelChoice: ShotVideoTakeInputModelChoice;
  models: ShotVideoTakeInputModelChoiceReport[];
}

export interface ShotVideoTakePreflightInput extends ShotVideoTakeGenerationInput {
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
}

export interface ShotVideoTakePreflightDependency {
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  purpose?: MediaGenerationPurpose;
  outputInputKind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  mediaKind: 'image' | 'audio' | 'video';
  required: boolean;
  reason: string;
}

export interface ShotVideoTakePreflightPrompt {
  purpose: ShotVideoTakeInputGenerationPurpose | typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  prompt: string;
  negativePrompt?: string;
  title?: string;
}

export type ShotVideoTakePreflightInputItemStatus =
  | 'ready'
  | 'available'
  | 'needed';

export interface ShotVideoTakePreflightInputCandidate {
  inputId: string;
  label: string;
}

export interface ShotVideoTakePreflightInputSlot {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export interface ShotVideoTakePreflightInputItem {
  key: string;
  title: string;
  caption: string;
  mediaKind: 'image' | 'audio' | 'video';
  status: ShotVideoTakePreflightInputItemStatus;
  assetId?: string;
  assetFileId?: string;
  projectRelativePath?: ProjectRelativePath;
  url?: string;
  planLineId?: string;
  dependencyLineId?: string;
  purpose?: MediaGenerationPurpose | null;
  pricing?: MediaGenerationDependencyPricing;
  slot?: ShotVideoTakePreflightInputSlot;
  candidates?: ShotVideoTakePreflightInputCandidate[];
  selectedInputId?: string | null;
}

export interface ShotVideoTakePreflightFinalTake {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  canCreateSpec: boolean;
  title: string;
}

export interface ShotVideoTakePreflightReport {
  valid: boolean;
  issues: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  plan?: ShotVideoTakeGenerationPlan;
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  availableInputs: ShotVideoTakeAvailableInput[];
  inputsToCreate: ShotVideoTakePreflightDependency[];
  inputPlanItems: ShotVideoTakePreflightInputItem[];
  prompts: ShotVideoTakePreflightPrompt[];
  finalTake: ShotVideoTakePreflightFinalTake;
  agentBrief: string;
  estimate: GenerationEstimate | null;
}

export interface ShotVideoTakeProductionEstimateReport {
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  modelChoice: ShotVideoTakeModelChoice;
  estimate: GenerationEstimate | null;
  plan?: ShotVideoTakeGenerationPlan;
  issues: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export type ShotVideoTakeReferenceChoiceState =
  | 'selected-ready'
  | 'selected-planned'
  | 'available'
  | 'not-selected'
  | 'unavailable';

export interface ShotVideoTakeReferenceImagePreview {
  inputId?: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  title: string;
  alt: string;
  url?: string;
}

export interface ShotVideoTakeReferenceCardPlan {
  state: ShotVideoTakeReferenceChoiceState;
  mediaKind: MediaKind;
  dependencyId?: string;
  dependencyLineId?: string;
  planLineId?: string;
  defaultIncluded: boolean;
  included: boolean;
  required: boolean;
  inclusionOverride: 'include' | 'exclude' | null;
  purpose?: MediaGenerationPurpose | null;
  pricing: MediaGenerationDependencyPricing;
  previews: ShotVideoTakeReferenceImagePreview[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export type ShotVideoTakeGeneralReferenceKind =
  | 'first-frame'
  | 'last-frame'
  | 'reference-image'
  | 'multi-shot-storyboard-sheet';

export interface ShotVideoTakeGeneralReferenceChoice {
  id: string;
  kind: ShotVideoTakeGeneralReferenceKind;
  title: string;
  selected: boolean;
  clearInputSlot: {
    kind: ShotVideoTakeInputKind;
    subjectKind?: ShotVideoTakeInputSubjectKind;
    subjectId?: string;
  } | null;
  card: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeLookbookReferenceChoice {
  id: string;
  lookbookId: string;
  lookbookSheetId: string | null;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeDialogueAudioReferenceChoice {
  dependencyId: string;
  dialogueId: string;
  castMemberId: string | null;
  speakerName: string;
  plainText: string;
  audioState:
    | 'ready'
    | 'not-generated'
    | 'no-picked-take'
    | 'multiple-picked-takes'
    | 'missing-file';
  pickedTake: {
    takeId: string;
    takeLabel: string;
    createdAt: string;
    assetId: string;
    assetFileId: string;
  } | null;
  takeCount: number;
  defaultIncluded: boolean;
  included: boolean;
  required: boolean;
  unavailableReason: string | null;
  card: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeDialogueAudioCapabilityReport {
  state: 'ok' | 'unsupported' | 'over-limit';
  supported: boolean;
  selectedCount: number;
  maxCount: number | null;
  modelLabel: string;
  message: string;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface ShotVideoTakeCastMemberReferenceGroup {
  castMemberId: string;
  name: string;
  role: string | null;
  selectedForShot: boolean;
  defaultSelectedForShot: boolean;
  selectedCharacterSheetAssetId: string | null;
  defaultCharacterSheetAssetId: string | null;
  characterSheets: ShotVideoTakeCharacterSheetReferenceChoice[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface ShotVideoTakeCharacterSheetReferenceChoice {
  id: string;
  castMemberId: string;
  assetId: string | null;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeLocationReferenceGroup {
  locationId: string;
  name: string;
  selectedForShot: boolean;
  defaultSelectedForShot: boolean;
  selectedEnvironmentSheetAssetId: string | null;
  defaultEnvironmentSheetAssetId: string | null;
  selectedViewIds: LocationAzimuthViewId[];
  environmentSheets: ShotVideoTakeEnvironmentSheetReferenceChoice[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface ShotVideoTakeEnvironmentSheetReferenceChoice {
  id: string;
  locationId: string;
  assetId: string | null;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
  views: ShotVideoTakeLocationViewReferenceChoice[];
}

export interface ShotVideoTakeLocationViewReferenceChoice {
  id: string;
  viewId: LocationAzimuthViewId;
  label: string;
  selected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeReferenceSectionsReport {
  general: ShotVideoTakeGeneralReferenceChoice[];
  lookbook: ShotVideoTakeLookbookReferenceChoice[];
  dialogueAudio: ShotVideoTakeDialogueAudioReferenceChoice[];
  dialogueAudioCapability: ShotVideoTakeDialogueAudioCapabilityReport;
  castMembers: ShotVideoTakeCastMemberReferenceGroup[];
  locations: ShotVideoTakeLocationReferenceGroup[];
}

export interface ShotVideoTakeProductionPlanReport {
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  finalPrompt: ShotVideoTakePromptDraft | null;
  plan: ShotVideoTakeGenerationPlan;
  references: ShotVideoTakeReferenceSectionsReport;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export type ShotVideoInputPolicyMode = 'reuse-selected' | 'regenerate' | 'auto';

export interface ShotVideoTakeInputPolicy {
  defaultMode: ShotVideoInputPolicyMode;
  slotModes?: Record<string, ShotVideoInputPolicyMode>;
}

export interface ShotVideoTakeGenerationPlanRequest {
  projectId: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  inputMode: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  modelChoice: ShotVideoTakeModelChoice;
  routeSettings: ShotVideoTakeParameterValues;
  inputPolicy: ShotVideoTakeInputPolicy;
}

export interface ShotVideoTakePlanModel {
  choice: ShotVideoTakeModelChoice;
  label: string;
  version: string;
  provider: 'fal-ai';
}

export interface ShotVideoTakePlanRoute {
  inputMode: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  providerModel: string;
  mode: 'text-to-video' | 'image-to-video';
  inputRoles: ShotVideoTakeModelInputRoleReport[];
  parameters: ShotVideoTakeParameterReport[];
}

export interface ShotVideoTakeGenerationPlanEstimate {
  state: 'complete' | 'partial' | 'unavailable';
  estimatedTotalUsd: number | null;
  pricedLineCount: number;
  unpricedLineCount: number;
  missingLineCount: number;
  requiresPriceOverride: boolean;
}

export interface ShotVideoTakeGenerationPlan {
  planId: string;
  request: ShotVideoTakeGenerationPlanRequest;
  model: ShotVideoTakePlanModel;
  route: ShotVideoTakePlanRoute;
  dependencyInventory: MediaGenerationDependencyInventory;
  lines: MediaGenerationPlanLine[];
  estimate: ShotVideoTakeGenerationPlanEstimate;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  finalEstimate: GenerationEstimate | null;
}

export interface ShotVideoTakeInputMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotMediaGenerationTarget;
  imported: Asset;
  input: ShotVideoTakeAvailableInput;
  receipt?: unknown;
  resourceKeys: string[];
}

export interface ShotVideoTakeMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  imported: Asset;
  take: SceneShotVideoTake;
  receipt?: unknown;
  resourceKeys: string[];
}
