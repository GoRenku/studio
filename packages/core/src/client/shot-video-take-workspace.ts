import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  CameraAngleId,
  MoveDirectionId,
  MoveTrackId,
  RigId,
  SceneShot,
  ShotLensSpecs,
  ShotMovementId,
  ShotSizeId,
  SubjectFramingId,
} from './scene-shot-list.js';
import type {
  GenerationContext,
  GenerationCostEstimate,
  GenerationReferenceSelection,
  GenerationRun,
  GenerationSpecRecord,
  JsonScalar,
  JsonValue,
} from './generation.js';
import type { ProjectRelativePath } from './project.js';
import type { RecoverableMutationReport } from './trash.js';

export type ShotVideoTakeInputModeId =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference'
  | 'source-video-reference';
export type ShotVideoTakeModelChoice = string;
export type ShotVideoTakeParameterValue =
  | JsonScalar
  | string[]
  | number[]
  | boolean[]
  | { kind: 'dimensions'; width: number; height: number }
  | { [key: string]: JsonValue };
export type ShotVideoTakeParameterValues = Record<string, JsonValue>;
export type ShotVideoTakeShotGroupMode = 'single-shot' | 'multi-shot';
export type SceneShotVideoTakeStructureMode = 'continuous' | 'multi-cut';

export interface ShotVideoTakePromptDraft {
  prompt: string;
  negativePrompt?: string;
}

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
  cast?: { castMemberIds?: string[] };
  location?: { locationId?: string };
  dialogue?: Array<{
    dialogueId: string;
    inclusion: 'include' | 'exclude';
  }>;
}

export type SceneShotVideoTakeStructure =
  | { mode: 'continuous'; sharedDirection: SceneShotVideoTakeDirection }
  | {
      mode: 'multi-cut';
      directionsByShotId: Record<string, SceneShotVideoTakeDirection>;
    };

export interface SceneShotVideoTakeState {
  version: 3;
  structure: SceneShotVideoTakeStructure;
}

export interface SceneShotVideoTakeStatus {
  editability: {
    state: 'editable' | 'read-only';
    diagnostics: DiagnosticIssue[];
    message: string;
  };
  resolvability: {
    state: 'resolvable' | 'missing-references';
    diagnostics: DiagnosticIssue[];
    message: string;
  };
  archive: {
    state: 'active' | 'archived' | 'pruned';
    message: string;
  };
  history: { differences: string[]; message: string };
}

export interface SceneShotVideoTakeVideo {
  takeId: string;
  assetId: string;
  assetFileId: string;
  generationRunId?: string;
  projectRelativePath: ProjectRelativePath;
  mimeType: string | null;
  createdAt: string;
}

export interface SceneShotVideoTake {
  takeId: string;
  sceneId: string;
  sourceShotListId: string;
  title: string;
  shotIds: string[];
  picked: boolean;
  video: SceneShotVideoTakeVideo | null;
  state: SceneShotVideoTakeState;
  status: SceneShotVideoTakeStatus;
  createdAt: string;
  updatedAt: string;
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

export interface ShotVideoTakeShotListContext {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface SceneShotVideoTakeOverview {
  take: SceneShotVideoTake;
  sourceShotList: ShotVideoTakeShotListContext;
  displayShots: SceneShot[];
  overviewShotIds: string[];
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
}
export interface SceneShotVideoTakeListReport {
  takes: SceneShotVideoTakeOverview[];
}
export interface SceneShotVideoTakeCreateReport {
  overview: SceneShotVideoTakeOverview;
  resourceKeys: string[];
}

export interface ShotVideoTakeReferenceImagePreview {
  selectionId: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  title: string;
  alt: string;
}
export interface ShotVideoTakeReferenceCard {
  state: 'selected-ready' | 'available' | 'not-selected' | 'unavailable';
  selectionId: string;
  defaultIncluded: boolean;
  included: boolean;
  required: boolean;
  previews: ShotVideoTakeReferenceImagePreview[];
  diagnostics: DiagnosticIssue[];
}
export interface ShotVideoTakeGeneralReferenceChoice {
  id: string;
  kind: 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet';
  title: string;
  selected: boolean;
  card: ShotVideoTakeReferenceCard;
}
export interface ShotVideoTakeLookbookReferenceChoice {
  id: string;
  lookbookId: string;
  lookbookSheetId: string | null;
  title: string;
  selected: boolean;
  card: ShotVideoTakeReferenceCard;
}
export interface ShotVideoTakeCharacterSheetReferenceChoice {
  id: string;
  castMemberId: string;
  assetId: string | null;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  card: ShotVideoTakeReferenceCard;
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
  diagnostics: DiagnosticIssue[];
}
export interface ShotVideoTakeEnvironmentSheetReferenceChoice {
  id: string;
  locationId: string;
  assetId: string | null;
  title: string;
  description: string | null;
  selected: boolean;
  card: ShotVideoTakeReferenceCard;
}
export interface ShotVideoTakeLocationReferenceGroup {
  locationId: string;
  name: string;
  selectedForShot: boolean;
  defaultSelectedForShot: boolean;
  selectedLocationSheetAssetId: string | null;
  environmentSheets: ShotVideoTakeEnvironmentSheetReferenceChoice[];
  diagnostics: DiagnosticIssue[];
}
export interface ShotVideoTakeDialogueAudioReferenceChoice {
  selectionId: string;
  dialogueId: string;
  castMemberId: string | null;
  speakerName: string;
  plainText: string;
  audioState: 'ready' | 'not-generated' | 'no-selected-take' | 'missing-file';
  selectedTake: {
    takeId: string;
    takeLabel: string;
    createdAt: string;
    assetId: string;
    assetFileId: string;
  } | null;
  availableTakes: Array<{
    takeId: string;
    selectionId: string;
  }>;
  takeCount: number;
  defaultIncluded: boolean;
  included: boolean;
  required: boolean;
  unavailableReason: string | null;
  card: ShotVideoTakeReferenceCard;
}
export interface ShotVideoTakeDialogueAudioCapabilityReport {
  state: 'ok' | 'unsupported' | 'over-limit';
  supported: boolean;
  selectedCount: number;
  maxCount: number | null;
  modelLabel: string;
  message: string;
  diagnostics: DiagnosticIssue[];
}
export interface ShotVideoTakeReferenceSections {
  general: ShotVideoTakeGeneralReferenceChoice[];
  lookbook: ShotVideoTakeLookbookReferenceChoice[];
  dialogueAudio: ShotVideoTakeDialogueAudioReferenceChoice[];
  dialogueAudioCapability: ShotVideoTakeDialogueAudioCapabilityReport;
  castMembers: ShotVideoTakeCastMemberReferenceGroup[];
  locations: ShotVideoTakeLocationReferenceGroup[];
}

export interface ShotVideoTakeParameterReport {
  name: string;
  label: string;
  required: boolean;
  defaultValue?: ShotVideoTakeParameterValue;
  allowedValues?: ShotVideoTakeParameterValue[];
  minimum?: number;
  maximum?: number;
}
export interface ShotVideoTakeModelReport {
  modelChoice: ShotVideoTakeModelChoice;
  provider: string;
  model: string;
  label: string;
  supportedInputModes: ShotVideoTakeInputModeId[];
  duration: {
    supported: boolean;
    values?: number[];
    minimum?: number;
    maximum?: number;
    default?: number;
  };
  parameters: ShotVideoTakeParameterReport[];
}
export interface ShotVideoTakeGenerationSetup {
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice?: ShotVideoTakeModelChoice;
  parameterValues: ShotVideoTakeParameterValues;
}

export function selectShotVideoTakeGenerationModel(
  setup: ShotVideoTakeGenerationSetup,
  model: ShotVideoTakeModelReport
): ShotVideoTakeGenerationSetup {
  if (setup.modelChoice === model.modelChoice) {
    return setup;
  }
  return {
    ...setup,
    modelChoice: model.modelChoice,
    parameterValues: Object.fromEntries(
      model.parameters.flatMap((parameter) =>
        parameter.defaultValue === undefined
          ? []
          : [[parameter.name, parameter.defaultValue]]
      )
    ),
  };
}
export interface ShotVideoTakeGenerationSession {
  context: GenerationContext;
  spec: GenerationSpecRecord | null;
  setup: ShotVideoTakeGenerationSetup;
  models: ShotVideoTakeModelReport[];
  references: ShotVideoTakeReferenceSections;
  finalPrompt: ShotVideoTakePromptDraft | null;
  estimate: GenerationCostEstimate | null;
  run: GenerationRun | null;
  diagnostics: DiagnosticIssue[];
}
export interface ShotVideoTakeWorkspace {
  take: SceneShotVideoTake;
  sourceShotList: ShotVideoTakeShotListContext;
  sourceShots: SceneShot[];
  displayShots: SceneShot[];
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
  generation: ShotVideoTakeGenerationSession;
  resourceKeys: string[];
}
export interface ShotVideoTakeWorkspaceMutationReport {
  workspace: ShotVideoTakeWorkspace;
  resourceKeys: string[];
  recovery?: RecoverableMutationReport['recovery'];
}
export interface ShotVideoTakePickReport {
  take: SceneShotVideoTake;
  resourceKeys: string[];
}
export interface ShotVideoTakeGenerationSpecInput {
  setup: ShotVideoTakeGenerationSetup;
  references?: GenerationReferenceSelection[];
}

export function sceneShotVideoTakeDirectionHasState(
  direction: SceneShotVideoTakeDirection | undefined
): boolean {
  if (!direction) {
    return false;
  }
  return Boolean(
    direction.composition ||
      direction.motion ||
      direction.cast?.castMemberIds?.length ||
      direction.location?.locationId ||
      direction.dialogue?.length
  );
}
