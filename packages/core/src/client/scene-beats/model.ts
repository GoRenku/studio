import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from '../assets.js';
import type { Project } from '../project/index.js';
import type { Scene, ScreenplayBlock, ScreenplaySection } from '../screenplay/index.js';

export interface BeatInput {
  title: string;
  description: string;
  narrativeDevelopment: string;
  narrativePurpose: string;
  castMemberIds: string[];
  locationIds: string[];
  propIds: string[];
  screenplayBlockIds: string[];
}

export interface Beat extends BeatInput {
  id: string;
  number: string;
}

export interface SceneBeatsInput {
  sceneId: string;
  beats: BeatInput[];
}

export interface SceneBeats {
  sceneId: string;
  beats: Beat[];
}

export interface SceneBeatsOperationsInput {
  sceneId: string;
  baseRevisionId: string;
  activate: boolean;
  operations: SceneBeatsOperation[];
}

export type SceneBeatsOperation =
  | { operation: 'beats.insert'; placement: BeatPlacement; beats: BeatInput[] }
  | { operation: 'beat.update'; beatId: string; beat: BeatInput }
  | { operation: 'beats.delete'; beatIds: string[] };

export type BeatPlacement =
  | { position: 'start' | 'end' }
  | { position: 'before' | 'after'; beatId: string };

export interface SceneBeatsProjectReport {
  projectName: string;
  id?: string;
  projectFolder?: string;
}

export interface SceneBeatsRevisionSummary {
  id: string;
  sceneId: string;
  baseRevisionId?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface SceneBeatsRevision {
  revision: SceneBeatsRevisionSummary;
  sceneBeats: SceneBeats;
}

export interface SceneBeatsCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: SceneBeatsProjectReport;
  resourceKeys: string[];
}

export interface SceneBeatsContextReport extends SceneBeatsCommandReport {
  project: SceneBeatsProjectReport & Pick<Project,
    | 'title' | 'aspectRatio' | 'logline' | 'synopsis' | 'premise'
    | 'primaryGenre' | 'secondaryGenres' | 'tones' | 'themes'
  >;
  sections: ScreenplaySection[];
  scene: Pick<Scene, 'id' | 'productionNumber' | 'heading' | 'title' | 'blocks'>;
  cast: Array<{ id: string; name: string; isVoiceOver: boolean; role?: string; description?: string }>;
  locations: Array<{ id: string; name: string; timePeriod?: string; description?: string; visualNotes?: string }>;
  props: Array<{ id: string; name: string; description?: string; visualNotes?: string }>;
  activeLookbook: {
    id: string;
    name: string;
    thesis: string;
    palette: string;
    camera: string;
    toneMood: string;
    texture: string;
    composition: string;
    lighting: string;
  } | null;
  activeRevision: SceneBeatsRevisionSummary | null;
  visualReferences?: { note: string };
}

export interface SceneBeatsRevisionListReport extends SceneBeatsCommandReport {
  sceneId: string;
  revisions: SceneBeatsRevisionSummary[];
  activeRevisionId: string | null;
}

export interface SceneBeatsRevisionReadReport extends SceneBeatsCommandReport {
  sceneBeats: SceneBeats | null;
  revision: SceneBeatsRevisionSummary | null;
  activeRevisionId: string | null;
}

export interface SceneBeatsValidationReport extends SceneBeatsCommandReport {
  sceneBeats: SceneBeatsInput;
}

export type SceneBeatsChange =
  | { type: 'sceneBeats.revisionCreated'; revisionId: string; sceneId: string }
  | { type: 'sceneBeats.activeRevisionSet'; revisionId: string; sceneId: string };

export interface SceneBeatsRevisionWriteReport extends SceneBeatsCommandReport {
  revision: SceneBeatsRevisionSummary;
  activeRevisionId: string;
  changes: SceneBeatsChange[];
}

export interface SceneBeatsOperationsReport extends SceneBeatsCommandReport {
  sceneId: string;
  baseRevisionId: string;
  createdRevisionId: string;
  activatedRevisionId: string | null;
  revision: SceneBeatsRevisionSummary;
  changes: Array<{ type: 'inserted' | 'updated' | 'deleted'; beatIds: string[] }>;
  storyboard: SceneStoryboardStatus;
}

export interface SceneStoryboardStatus extends SceneBeatsCommandReport {
  sceneId: string;
  sceneBeatsRevisionId: string;
  beats: Array<{
    beatId: string;
    beatNumber: string;
    images: Asset[];
    selectedImageId: string | null;
    needsStoryboardImage: boolean;
    reason?: 'missing';
  }>;
  missingBeatIds: string[];
  readyBeatIds: string[];
}

export interface SceneStoryboardImagesImportDocument {
  select: boolean;
  title?: string;
  sceneBeatsRevisionId: string;
  beats: Array<{
    beatId: string;
    source: string;
    title?: string;
    sourcePurpose?: 'scene.storyboard-sheet';
    sourceSpecId?: string;
    sourceRunId?: string;
  }>;
}

export interface SceneStoryboardImagesImportedFile {
  role: 'storyboard_image';
  beatId?: string;
  projectRelativePath: string;
}

export interface SceneStoryboardImagesImportReport extends SceneBeatsCommandReport {
  changes: Array<{ type: string; [key: string]: string }>;
  purpose: 'scene.storyboard-sheet';
  target: { kind: 'scene'; id: string };
  sceneBeatsRevisionId: string;
  imported: Asset[];
  files: SceneStoryboardImagesImportedFile[];
}

export type SceneBeatsBlock = ScreenplayBlock;
