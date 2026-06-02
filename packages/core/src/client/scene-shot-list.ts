import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Block, SceneSetting } from './screenplay.js';

export interface SceneShotListDocument {
  kind: 'sceneShotList';
  sceneId: string;
  title: string;
  summary: string;
  coverageStrategy: string;
  lookbookInfluence?: string;
  shots: SceneShot[];
  videoTakeProductionGroups?: ShotVideoTakeProductionGroup[];
  openQuestions?: string[];
}

export type ShotVideoTakeIntentId =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference'
  | 'multi-shot'
  | 'audio-to-video'
  | 'extend-or-edit';

export type ShotVideoTakeModelChoice =
  | 'fal-ai/xai/grok-imagine-video/text-to-video'
  | 'fal-ai/xai/grok-imagine-video/image-to-video'
  | 'fal-ai/veo3.1/first-last-frame-to-video'
  | 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'
  | 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video';

export type ShotVideoTakeParameterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[];

export type ShotVideoTakeParameterValues = Record<
  string,
  ShotVideoTakeParameterValue
>;

export type ShotVideoTakeInputKind =
  | 'first-frame'
  | 'last-frame'
  | 'reference-image'
  | 'shot-reference-sheet'
  | 'character-sheet'
  | 'location-sheet'
  | 'multi-shot-storyboard-sheet'
  | 'source-video'
  | 'audio';

export type ShotVideoTakeInputSubjectKind =
  | 'asset'
  | 'cast-member'
  | 'location'
  | 'lookbook'
  | 'production-group'
  | 'shot';

export type ShotVideoTakeDependencyKind =
  | 'first-frame'
  | 'last-frame'
  | 'shot-reference-sheet'
  | 'multi-shot-storyboard-sheet'
  | 'reference-audio'
  | 'source-video-extract';

export interface ShotVideoTakeRequestedInput {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  fulfillmentMode?: 'reuse-existing' | 'generate-new';
  note?: string;
}

export interface ShotVideoTakePreparedInput {
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId?: string;
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
}

export interface ShotVideoTakeProductionGroup {
  productionGroupId: string;
  shotIds: string[];
  videoTakeProduction: ShotVideoTakeProductionPlan;
}

export interface ShotVideoTakeProductionPlan {
  intentId?: ShotVideoTakeIntentId;
  modelChoice?: ShotVideoTakeModelChoice;
  parameterValues?: ShotVideoTakeParameterValues;
  requestedInputs?: ShotVideoTakeRequestedInput[];
  preparedInputs?: ShotVideoTakePreparedInput[];
  agentProposal?: ShotVideoTakeAgentProposal;
  customPromptNote?: string;
}

export interface ShotVideoTakeAgentProposal {
  basedOnIntentId: ShotVideoTakeIntentId;
  basedOnModelChoice: ShotVideoTakeModelChoice;
  dependencyDrafts: ShotVideoTakeDependencyDraft[];
  finalPromptDraft?: ShotVideoTakePromptDraft;
}

export interface ShotVideoTakeDependencyDraft {
  purpose: import('./media-generation.js').ShotVideoTakeInputGenerationPurpose;
  dependencyKind: ShotVideoTakeDependencyKind;
  outputInputKind: ShotVideoTakeInputKind;
  modelChoice?: import('./media-generation.js').ShotVideoTakeInputModelChoice;
  prompt: string;
  parameterValues?: ShotVideoTakeParameterValues;
  title?: string;
}

export interface ShotVideoTakePromptDraft {
  prompt: string;
  negativePrompt?: string;
  title?: string;
}

export interface SceneShot {
  shotId: string;
  title: string;
  storyBeat: string;
  narrativePurpose: string;
  description: string;
  shotType: string;
  cameraAngle?: string;
  cameraMovement?: string;
  framing?: string;
  lensIntent?: string;
  aspectRatio?: string;
  subject: string;
  action: string;
  dialogue: SceneShotDialogueReference[];
  coveredBlockIndexes: number[];
  castMemberIds: string[];
  locationIds: string[];
  audioNotes?: string;
  productionNotes?: string;
  /**
   * Optional structured shot specifications (0036). Absence means the shot has
   * not been specified in the Studio shot tabs yet. The free-text strings above
   * (`shotType`, `cameraAngle`, `cameraMovement`, `framing`) remain the
   * prompt-facing contract and are derived from this structure on each edit.
   */
  shotSpecs?: ShotSpecs;
}

/**
 * Single ordered shot-size ladder, tightest to widest. The mockup's overlapping
 * close/medium/long columns collapse onto these rungs (see 0036).
 */
export type ShotSizeId =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium-shot'
  | 'medium-full-shot'
  | 'full-shot'
  | 'wide-shot'
  | 'extreme-wide-shot';

/** Who/what is in frame and their relationship. Multi-select (see 0036). */
export type SubjectFramingId =
  | 'single'
  | 'two-shot'
  | 'three-shot'
  | 'group'
  | 'over-the-shoulder'
  | 'over-the-hip'
  | 'point-of-view'
  | 'insert'
  | 'reaction';

/** Vertical viewpoint / camera height, merged into one single-select ladder. */
export type CameraAngleId =
  | 'ground-level'
  | 'knee-level'
  | 'hip-level'
  | 'shoulder-level'
  | 'eye-level'
  | 'low-angle'
  | 'high-angle'
  | 'overhead';

/** What the frame does over time. Single primary value (see 0036). */
export type ShotMovementId =
  | 'static'
  | 'pan'
  | 'tilt'
  | 'swish-pan'
  | 'swish-tilt'
  | 'tracking'
  | 'push-in'
  | 'pull-out'
  | 'zoom'
  | 'rack-focus';

/** Rough directional descriptors for the move. Multi-select. */
export type MoveDirectionId =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'up'
  | 'down';

/** Track shape for moving shots. */
export type MoveTrackId = 'straight' | 'circular';

/** How the camera is supported and moved. Single-select (see 0036). */
export type RigId =
  | 'sticks'
  | 'hand-held'
  | 'gimbal'
  | 'slider'
  | 'jib'
  | 'drone'
  | 'dolly'
  | 'steadicam'
  | 'crane';

export type LensId =
  | 'ultra-wide'
  | 'wide'
  | 'normal'
  | 'short-tele'
  | 'tele'
  | 'macro';

export type FocusId =
  | 'deep-focus'
  | 'shallow-focus'
  | 'rack-focus'
  | 'tilt-shift';

export type LocationAzimuthViewId =
  | 'front'
  | 'right'
  | 'back'
  | 'left';

export interface ShotMovementSpecs {
  movement?: ShotMovementId;
  secondary?: ShotMovementId;
  directions?: MoveDirectionId[];
  track?: MoveTrackId;
  rig?: RigId;
}

export interface ShotLensSpecs {
  type?: LensId;
  millimeters?: number;
  focus?: FocusId;
}

export interface ShotLocationSpecs {
  locationId?: string;
  usesDifferentLocation?: boolean;
  azimuthView?: LocationAzimuthViewId;
  customView?: string;
}

export interface ShotCustomSpecs {
  composition?: string;
  movement?: string;
}

export interface ShotSpecs {
  shotSize?: ShotSizeId;
  subjectFraming?: SubjectFramingId[];
  cameraAngle?: CameraAngleId;
  dutch?: 'left' | 'right';
  movement?: ShotMovementSpecs;
  lens?: ShotLensSpecs;
  location?: ShotLocationSpecs;
  custom?: ShotCustomSpecs;
}

export interface SceneShotDialogueReference {
  blockIndex: number;
  lineIndexes?: number[];
  castMemberId?: string;
  purpose: string;
}

export interface SceneShotListProjectReport {
  name: string;
  id?: string;
  projectFolder?: string;
}

export interface SceneShotListSummary {
  id: string;
  sceneId: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface SceneShotListCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: SceneShotListProjectReport;
  resourceKeys: string[];
}

export interface SceneShotListContextReport
  extends SceneShotListCommandReport {
  project: SceneShotListProjectReport & {
    title: string;
    aspectRatio: string | null;
  };
  screenplay: SceneShotListContextScreenplay;
  act: SceneShotListContextAct;
  sequence: SceneShotListContextSequence;
  scene: SceneShotListContextScene;
  cast: SceneShotListContextCastMember[];
  locations: SceneShotListContextLocation[];
  activeLookbook: SceneShotListContextLookbook | null;
  activeShotList: SceneShotListSummary | null;
  visualReferences?: SceneShotListVisualReferences;
}

export interface SceneShotListContextScreenplay {
  title: string;
  logline?: string;
  summary?: string;
  genrePrimary?: string;
  genreSecondary?: string[];
  tone?: string[];
  themes?: string[];
}

export interface SceneShotListContextAct {
  id: string;
  title?: string;
  purpose?: string;
}

export interface SceneShotListContextSequence {
  id: string;
  title?: string;
  purpose?: string;
}

export interface SceneShotListContextScene {
  id: string;
  title: string;
  setting: SceneSetting;
  storyFunction: string[];
  blocks: Block[];
}

export interface SceneShotListContextCastMember {
  id: string;
  handle: string;
  name: string;
  role?: string;
  description?: string;
}

export interface SceneShotListContextLocation {
  id: string;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}

export interface SceneShotListContextLookbook {
  id: string;
  name: string;
  thesis: string;
  palette: string;
  camera: string;
  toneMood: string;
  texture: string;
  composition: string;
  lighting: string;
}

export interface SceneShotListVisualReferences {
  note: string;
}

export interface SceneShotListListReport extends SceneShotListCommandReport {
  sceneId: string;
  shotLists: SceneShotListSummary[];
  activeShotListId: string | null;
}

export interface SceneShotListReadReport extends SceneShotListCommandReport {
  shotList: SceneShotListDocument | null;
  summary: SceneShotListSummary | null;
  activeShotListId: string | null;
}

export interface SceneShotListValidationReport
  extends SceneShotListCommandReport {
  shotList: SceneShotListDocument;
}

export type SceneShotListChange =
  | { type: 'sceneShotList.created'; shotListId: string; sceneId: string }
  | { type: 'sceneShotList.activeSet'; shotListId: string; sceneId: string };

export interface SceneShotListWriteReport extends SceneShotListCommandReport {
  shotList: SceneShotListSummary;
  activeShotListId: string;
  changes: SceneShotListChange[];
}

export interface SceneStoryboardSheetImportDocument {
  kind: 'sceneStoryboardSheetImport';
  title?: string;
  sheets: SceneStoryboardSheetImportSheet[];
}

export interface SceneStoryboardSheetImportSheet {
  source: string;
  title?: string;
  shots: SceneStoryboardSheetImportShot[];
}

export interface SceneStoryboardSheetImportShot {
  shotId: string;
  source: string;
  title?: string;
}

export interface SceneStoryboardSheetImportedFile {
  role: 'sheet' | 'shot';
  sheetIndex?: number;
  shotId?: string;
  projectRelativePath: string;
}

export interface SceneStoryboardSheetImportReport
  extends SceneShotListCommandReport {
  changes: Array<{ type: string; [key: string]: string }>;
  purpose: 'scene.storyboard-sheet';
  target: { kind: 'scene'; id: string };
  shotListId: string;
  storyboardSheetId: string;
  storyboardSheetIds: string[];
  imported: import('./assets.js').Asset;
  files: SceneStoryboardSheetImportedFile[];
}
