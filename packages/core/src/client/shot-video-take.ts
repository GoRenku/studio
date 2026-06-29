import type { GenerationEstimate } from '@gorenku/studio-engines';
import type { Asset } from './assets.js';
import type { ProjectRelativePath } from './project.js';
import type { SceneSetting } from './screenplay.js';
import type { SceneShot, ShotVideoTakePromptDraft, ShotVideoTakeDependencyKind, ShotVideoTakeInputKind, ShotVideoTakeInputSubjectKind, ShotVideoTakeInputModeId, ShotVideoTakeShotGroupMode, ShotVideoTakeModelChoice, ShotVideoTakeParameterValues, SceneShotVideoTakeProductionState, ShotSizeId, SubjectFramingId, CameraAngleId, ShotLensSpecs, ShotMovementId, MoveDirectionId, MoveTrackId, RigId } from './scene-shot-list.js';
import type { MediaGenerationDependencyKind, MediaGenerationDependencyInventory, MediaGenerationDependencyPricing, MediaGenerationPlanLine } from './media-generation-dependency.js';
import type { MediaGenerationPurpose, MediaKind } from './media-generation-purpose.js';
import type { SceneShotVideoTakeTarget } from './media-generation-target.js';
import type { RecoverableMutationReport } from './trash.js';
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
  relationshipId: string;
  assetFileId: string;
  title: string;
  fileRole: string;
  mediaKind: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  projectRelativePath: ProjectRelativePath;
}

export type SceneShotVideoTakeHistoryDifference =
  | 'active-shot-list-changed'
  | 'shot-list-content-changed'
  | 'storyboard-images-changed'
  | 'selected-shots-missing'
  | 'selected-shot-content-changed'
  | 'selected-storyboard-images-changed'
  | 'scene-narrative-changed';

export interface SceneShotVideoTakeStatus {
  editability: {
    state: 'editable' | 'read-only';
    diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
    message: string;
  };
  resolvability: {
    state: 'resolvable' | 'missing-references';
    diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
    message: string;
  };
  runnability: {
    state: 'not-evaluated' | 'runnable' | 'blocked';
    diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
    message: string;
  };
  archive: {
    state: 'active' | 'archived' | 'pruned';
    message: string;
  };
  history: {
    differences: SceneShotVideoTakeHistoryDifference[];
    message: string;
  };
}

export interface SceneShotVideoTakeHistorySnapshot {
  activeShotListId: string | null;
  orderedShotIds: string[];
  shotListContentFingerprint: string;
  storyboardStateFingerprint: string;
  selectedShotIds: string[];
  selectedShotContentFingerprint: string;
  selectedStoryboardStateFingerprint: string;
}

export interface SceneShotVideoTakeHistoryStatus {
  differences: SceneShotVideoTakeHistoryDifference[];
  message: string;
}

export interface SceneShotVideoTake {
  takeId: string;
  sceneId: string;
  sourceShotListId: string;
  title: string;
  shotIds: string[];
  picked: boolean;
  state: SceneShotVideoTakeState;
  status: SceneShotVideoTakeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SceneShotVideoTakeAuthoringDocument {
  kind: 'sceneShotVideoTakeAuthoring';
  takeId: string;
  sceneId: string;
  sourceShotListId: string;
  baseTakeUpdatedAt?: string;
  shotIds: string[];
  structure: SceneShotVideoTakeStructure;
  production: SceneShotVideoTakeProductionState;
}

export interface ShotVideoTakeProviderPayloadPreview {
  available: boolean;
  issues: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  spec?: ShotVideoTakeOutputGenerationSpec;
  providerPayload?: Record<string, unknown>;
  generation?: import('./media-generation-lifecycle.js').PreparedMediaGeneration['generation'];
}

export interface SceneShotVideoTakeAuthoringContextReport {
  kind: 'sceneShotVideoTakeAuthoringContext';
  document: SceneShotVideoTakeAuthoringDocument;
  context: ShotVideoTakeProductionContext;
  productionPlan: ShotVideoTakeProductionPlanReport;
  preflight: ShotVideoTakePreflightReport;
  providerPreview: ShotVideoTakeProviderPayloadPreview;
  resourceKeys: string[];
}

export interface SceneShotVideoTakeAuthoringSnapshot {
  document: SceneShotVideoTakeAuthoringDocument;
  context: ShotVideoTakeProductionContext;
  productionPlan: ShotVideoTakeProductionPlanReport;
  preflight: ShotVideoTakePreflightReport;
  providerPreview: ShotVideoTakeProviderPayloadPreview;
  resourceKeys: string[];
}

export interface SceneShotVideoTakeAuthoringValidationReport {
  valid: true;
  document: SceneShotVideoTakeAuthoringDocument;
  prior: SceneShotVideoTakeAuthoringSnapshot;
  current: SceneShotVideoTakeAuthoringSnapshot;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface SceneShotVideoTakeAuthoringApplyReport {
  valid: true;
  document: SceneShotVideoTakeAuthoringDocument;
  project: {
    id: string;
    name: string;
    projectFolder: string;
  };
  prior: SceneShotVideoTakeAuthoringSnapshot;
  current: SceneShotVideoTakeAuthoringSnapshot;
  resourceKeys: string[];
}

export interface SceneShotVideoTakeOverview {
  take: SceneShotVideoTake;
  sourceShotList: ShotVideoTakeShotListContext;
  displayShots: SceneShot[];
  overviewShotIds: string[];
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
}

export interface SceneShotVideoTakeCreateReport {
  overview: SceneShotVideoTakeOverview;
  resourceKeys: string[];
}

export interface SceneShotVideoTakeListReport {
  takes: SceneShotVideoTakeOverview[];
}

export interface SceneShotVideoTakeState {
  version: 2;
  structure: SceneShotVideoTakeStructure;
  production: SceneShotVideoTakeProductionState;
  promptState?: SceneShotVideoTakePromptState;
}

export type SceneShotVideoTakeStructureMode = 'continuous' | 'multi-cut';

export type SceneShotVideoTakeStructure =
  | {
      mode: 'continuous';
      sharedDirection: SceneShotVideoTakeDirection;
    }
  | {
      mode: 'multi-cut';
      directionsByShotId: Record<string, SceneShotVideoTakeDirection>;
    };

export interface SceneShotVideoTakeDirection {
  composition?: {
    shotSize?: ShotSizeId;
    subjectFraming?: SubjectFramingId[];
    cameraAngle?: CameraAngleId;
    dutch?: 'left' | 'right';
    lens?: ShotLensSpecs;
    customComposition?: string;
  };
  motion?: {
    movement?: ShotMovementId;
    secondary?: ShotMovementId;
    directions?: MoveDirectionId[];
    track?: MoveTrackId;
    rig?: RigId;
    customMotion?: string;
  };
  cast?: {
    castMemberIds?: string[];
    characterSheetAssetIds?: Record<string, string>;
  };
  location?: {
    locationId?: string;
    environmentSheetAssetIds?: string[];
  };
  lookbook?: {
    lookbookId?: string;
    lookbookSheetId?: string;
  };
  referenceImages?: {
    customMediaInputIds?: string[];
  };
  dialogue?: {
    dialogueId: string;
    inclusion: 'include' | 'exclude';
    sceneDialogueAudioTakeId?: string;
    assetId?: string;
    assetFileId?: string;
  }[];
  referenceSelections?: SceneShotVideoTakeReferenceSelections;
}

export interface SceneShotVideoTakeReferenceSelections {
  dependencyInclusions: Record<string, 'include' | 'exclude'>;
  selectedCharacterSheetAssetIds: Record<string, string>;
  selectedLocationSheetAssetIds: Record<string, string>;
  selectedLookbookSheetIds: string[];
  selectedDialogueAudioTakeIds: Record<string, string>;
}

export function sceneShotVideoTakeDirectionHasShotProjectionFields(
  direction: SceneShotVideoTakeDirection | undefined
): boolean {
  if (!direction) {
    return false;
  }
  return (
    sceneShotVideoTakeDirectionHasPromptFields(direction) ||
    hasCast(direction.cast) ||
    hasLocation(direction.location)
  );
}

export function sceneShotVideoTakeDirectionHasPromptFields(
  direction: SceneShotVideoTakeDirection | undefined
): boolean {
  if (!direction) {
    return false;
  }
  return (
    hasComposition(direction.composition) ||
    hasMotion(direction.motion)
  );
}

export function sceneShotVideoTakeDirectionHasState(
  direction: SceneShotVideoTakeDirection | undefined
): boolean {
  if (!direction) {
    return false;
  }
  return (
    sceneShotVideoTakeDirectionHasShotProjectionFields(direction) ||
    hasLookbook(direction.lookbook) ||
    hasReferenceImages(direction.referenceImages) ||
    hasDialogue(direction.dialogue) ||
    hasReferenceSelections(direction.referenceSelections)
  );
}

function hasComposition(
  composition: SceneShotVideoTakeDirection['composition']
): boolean {
  if (!composition) {
    return false;
  }
  return Boolean(
    composition.shotSize ||
      composition.cameraAngle ||
      composition.dutch ||
      composition.subjectFraming?.length ||
      hasLens(composition.lens) ||
      composition.customComposition?.trim()
  );
}

function hasLens(
  lens: NonNullable<SceneShotVideoTakeDirection['composition']>['lens']
): boolean {
  if (!lens) {
    return false;
  }
  return Boolean(
    lens.type ||
      lens.millimeters !== undefined ||
      lens.focus
  );
}

function hasMotion(
  motion: SceneShotVideoTakeDirection['motion']
): boolean {
  if (!motion) {
    return false;
  }
  return Boolean(
    motion.movement ||
      motion.secondary ||
      motion.track ||
      motion.rig ||
      motion.directions?.length ||
      motion.customMotion?.trim()
  );
}

function hasCast(cast: SceneShotVideoTakeDirection['cast']): boolean {
  if (!cast) {
    return false;
  }
  return Boolean(
    cast.castMemberIds?.length ||
      Object.keys(cast.characterSheetAssetIds ?? {}).length
  );
}

function hasLocation(
  location: SceneShotVideoTakeDirection['location']
): boolean {
  if (!location) {
    return false;
  }
  return Boolean(
    location.locationId?.trim() ||
      location.environmentSheetAssetIds?.length
  );
}

function hasLookbook(
  lookbook: SceneShotVideoTakeDirection['lookbook']
): boolean {
  if (!lookbook) {
    return false;
  }
  return Boolean(lookbook.lookbookId?.trim() || lookbook.lookbookSheetId?.trim());
}

function hasReferenceImages(
  referenceImages: SceneShotVideoTakeDirection['referenceImages']
): boolean {
  if (!referenceImages) {
    return false;
  }
  return Boolean(referenceImages.customMediaInputIds?.length);
}

function hasDialogue(
  dialogue: SceneShotVideoTakeDirection['dialogue']
): boolean {
  return Boolean(dialogue?.length);
}

function hasReferenceSelections(
  referenceSelections: SceneShotVideoTakeReferenceSelections | undefined
): boolean {
  if (!referenceSelections) {
    return false;
  }
  return (
    Object.keys(referenceSelections.dependencyInclusions).length > 0 ||
    Object.keys(referenceSelections.selectedCharacterSheetAssetIds).length > 0 ||
    Object.keys(referenceSelections.selectedLocationSheetAssetIds).length > 0 ||
    referenceSelections.selectedLookbookSheetIds.length > 0 ||
    Object.keys(referenceSelections.selectedDialogueAudioTakeIds).length > 0
  );
}

export interface SceneShotVideoTakePromptState {
  generatedPromptDraft?: ShotVideoTakePromptDraft;
  acceptedPrompt?: ShotVideoTakePromptDraft;
  lastGeneratedFrom?: {
    inputModeId?: ShotVideoTakeInputModeId;
    modelChoice?: ShotVideoTakeModelChoice;
    shotIds: string[];
    dependencyIds: string[];
  };
}

export interface SceneShotVideoTakeMediaInput {
  inputId: string;
  kind: ShotVideoTakeInputKind;
  title: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image' | 'audio' | 'video';
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
  takeId: string;
  shotIds: string[];
  mediaGenerationRunId?: string;
  selected: boolean;
  createdAt: string;
}

export interface SceneShotVideoTakeOutput {
  outputId: string;
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

export interface ShotVideoTakeProductionContext {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotVideoTakeTarget;
  project: ShotVideoTakeProjectContext;
  scene: ShotVideoTakeSceneContext;
  shotList: ShotVideoTakeShotListContext;
  take: SceneShotVideoTake;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  shots: SceneShot[];
  displayShots: SceneShot[];
  selectedCast: ShotVideoTakeCastReference[];
  selectedLocations: ShotVideoTakeLocationReference[];
  activeLookbook: ShotVideoTakeLookbookReference | null;
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
  mediaInputs: SceneShotVideoTakeMediaInput[];
  outputs: SceneShotVideoTakeOutput[];
  defaults: ShotVideoTakeDefaults;
  recovery?: RecoverableMutationReport['recovery'];
  resourceKeys: string[];
}

export interface SceneShotVideoTakeAssetReadiness {
  selectedInputCount: number;
  readyInputCount: number;
  missingInputCount: number;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface SceneShotVideoTakeEditContext {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotVideoTakeTarget;
  project: ShotVideoTakeProjectContext;
  scene: ShotVideoTakeSceneContext;
  take: SceneShotVideoTake;
  sourceShotList: ShotVideoTakeShotListContext;
  sourceShots: SceneShot[];
  displayShots: SceneShot[];
  shotGroupMode: ShotVideoTakeShotGroupMode;
  selectedCast: ShotVideoTakeCastReference[];
  selectedLocations: ShotVideoTakeLocationReference[];
  activeLookbook: ShotVideoTakeLookbookReference | null;
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
  mediaInputs: SceneShotVideoTakeMediaInput[];
  outputs: SceneShotVideoTakeOutput[];
  assetReadiness: SceneShotVideoTakeAssetReadiness;
  defaults: ShotVideoTakeDefaults;
  resourceKeys: string[];
}

export interface ShotVideoTakeInputGenerationSpec {
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotVideoTakeTarget;
  planId?: string;
  dependencyKind: ShotVideoTakeDependencyKind;
  outputInputKind: ShotVideoTakeInputKind;
  modelChoice: ShotVideoTakeInputModelChoice;
  prompt: string;
  parameterValues: ShotVideoTakeParameterValues;
  title?: string;
}

export interface ShotVideoTakeOutputGenerationInput {
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

export interface ShotVideoTakeOutputGenerationSpec {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotVideoTakeTarget;
  planId?: string;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  prompt: string;
  negativePrompt?: string;
  parameterValues: ShotVideoTakeParameterValues;
  inputs: ShotVideoTakeOutputGenerationInput[];
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
  target: SceneShotVideoTakeTarget;
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
  target: SceneShotVideoTakeTarget;
  defaultModelChoice: ShotVideoTakeInputModelChoice;
  models: ShotVideoTakeInputModelChoiceReport[];
}

export interface ShotVideoTakePreflightInput extends ShotVideoTakeOutputGenerationInput {
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
  plan?: ShotVideoTakeOutputGenerationPlan;
  target: SceneShotVideoTakeTarget;
  take: SceneShotVideoTake;
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  mediaInputs: SceneShotVideoTakeMediaInput[];
  inputsToCreate: ShotVideoTakePreflightDependency[];
  inputPlanItems: ShotVideoTakePreflightInputItem[];
  prompts: ShotVideoTakePreflightPrompt[];
  finalTake: ShotVideoTakePreflightFinalTake;
  agentBrief: string;
  estimate: GenerationEstimate | null;
}

export interface ShotVideoTakeProductionEstimateReport {
  target: SceneShotVideoTakeTarget;
  take: SceneShotVideoTake;
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  modelChoice: ShotVideoTakeModelChoice;
  estimate: GenerationEstimate | null;
  plan?: ShotVideoTakeOutputGenerationPlan;
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
  takeId?: string;
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
    | 'no-selected-take'
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
  selectedLocationSheetAssetId: string | null;
  environmentSheets: ShotVideoTakeEnvironmentSheetReferenceChoice[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface ShotVideoTakeEnvironmentSheetReferenceChoice {
  id: string;
  locationId: string;
  assetId: string | null;
  title: string;
  description: string | null;
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
  target: SceneShotVideoTakeTarget;
  take: SceneShotVideoTake;
  finalPrompt: ShotVideoTakePromptDraft | null;
  plan: ShotVideoTakeOutputGenerationPlan;
  references: ShotVideoTakeReferenceSectionsReport;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export type ShotVideoInputPolicyMode = 'reuse-selected' | 'regenerate' | 'auto';

export interface ShotVideoTakeInputPolicy {
  defaultMode: ShotVideoInputPolicyMode;
  slotModes?: Record<string, ShotVideoInputPolicyMode>;
}

export interface ShotVideoTakeOutputGenerationPlanRequest {
  projectId: string;
  sceneId: string;
  shotListId: string;
  takeId: string;
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

export interface ShotVideoTakeOutputGenerationPlanEstimate {
  state: 'complete' | 'partial' | 'unavailable';
  estimatedTotalUsd: number | null;
  pricedLineCount: number;
  unpricedLineCount: number;
  missingLineCount: number;
  requiresPriceOverride: boolean;
}

export interface ShotVideoTakeOutputGenerationPlan {
  planId: string;
  request: ShotVideoTakeOutputGenerationPlanRequest;
  model: ShotVideoTakePlanModel;
  route: ShotVideoTakePlanRoute;
  dependencyInventory: MediaGenerationDependencyInventory;
  lines: MediaGenerationPlanLine[];
  estimate: ShotVideoTakeOutputGenerationPlanEstimate;
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
  target: SceneShotVideoTakeTarget;
  imported: Asset;
  mediaInput: SceneShotVideoTakeMediaInput;
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
  target: SceneShotVideoTakeTarget;
  imported: Asset;
  output: SceneShotVideoTakeOutput;
  receipt?: unknown;
  resourceKeys: string[];
}
