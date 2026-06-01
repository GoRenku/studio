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
  openQuestions?: string[];
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
   * Optional structured camera-design selections (0036). Absence means the shot
   * has not been designed in the Studio camera tabs yet. The free-text strings
   * above (`shotType`, `cameraAngle`, `cameraMovement`, `framing`) remain the
   * prompt-facing contract and are derived from this structure on each edit.
   */
  cameraDesign?: ShotCameraDesign;
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

export interface ShotMovementDesign {
  movement?: ShotMovementId;
  secondary?: ShotMovementId;
  directions?: MoveDirectionId[];
  track?: MoveTrackId;
  rig?: RigId;
}

export interface ShotCameraDesignCustom {
  framing?: string;
  movement?: string;
}

export interface ShotCameraDesign {
  shotSize?: ShotSizeId;
  subjectFraming?: SubjectFramingId[];
  cameraAngle?: CameraAngleId;
  dutch?: 'left' | 'right';
  movement?: ShotMovementDesign;
  custom?: ShotCameraDesignCustom;
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
