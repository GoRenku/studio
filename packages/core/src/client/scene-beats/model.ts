import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from '../assets.js';
import type { Project } from '../project/index.js';
import type { Scene, ScreenplayBlock, ScreenplaySection } from '../screenplay/index.js';

export interface SceneBeatSheetDocument {
  sceneId: string;
  title: string;
  summary: string;
  narrativeProgression: string;
  baseBeatSheetId?: string;
  lookbookInfluence?: string;
  beats: Beat[];
  openQuestions?: string[];
}

export interface Beat {
  id: string;
  title: string;
  description: string;
  narrativeDevelopment: string;
  narrativePurpose: string;
  castMemberIds: string[];
  locationIds: string[];
  propIds: string[];
  screenplayBlockIds: string[];
}

export interface SceneBeatSheetOperationDocument {
  sceneId: string;
  baseBeatSheetId: string;
  activate: boolean;
  title?: string;
  summary?: string;
  narrativeProgression?: string;
  lookbookInfluence?: string;
  operations: SceneBeatSheetOperation[];
  openQuestions?: string[];
}

export type SceneBeatSheetOperation =
  | { operation: 'beats.insert'; placement: BeatPlacement; beats: Beat[]; storyboardPolicy?: SceneBeatSheetStoryboardPolicy }
  | { operation: 'beats.replace'; beatIds: string[]; beats: Beat[]; storyboardPolicy?: SceneBeatSheetStoryboardPolicy }
  | { operation: 'beat.update'; beat: Beat; storyboardPolicy?: SceneBeatSheetStoryboardPolicy }
  | { operation: 'beats.delete'; beatIds: string[] }
  | { operation: 'beatSheet.replace'; beats: Beat[]; storyboardPolicy?: SceneBeatSheetStoryboardPolicy };

export type BeatPlacement =
  | { position: 'start' | 'end' }
  | { position: 'before' | 'after'; beatId: string };

export type SceneBeatSheetStoryboardPolicy = 'generate' | 'reuse-if-unchanged' | 'missing-only';

export interface SceneBeatSheetProjectReport {
  projectName: string;
  id?: string;
  projectFolder?: string;
}

export interface SceneBeatSheetSummary {
  id: string;
  sceneId: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  baseBeatSheetId?: string;
}

export interface SceneBeatSheetCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: SceneBeatSheetProjectReport;
  resourceKeys: string[];
}

export interface SceneBeatSheetContextReport extends SceneBeatSheetCommandReport {
  project: SceneBeatSheetProjectReport & Pick<Project,
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
  activeBeatSheet: SceneBeatSheetSummary | null;
  visualReferences?: { note: string };
}

export interface SceneBeatSheetListReport extends SceneBeatSheetCommandReport {
  sceneId: string;
  beatSheets: SceneBeatSheetSummary[];
  activeBeatSheetId: string | null;
}

export interface SceneBeatSheetReadReport extends SceneBeatSheetCommandReport {
  beatSheet: SceneBeatSheetDocument | null;
  summary: SceneBeatSheetSummary | null;
  activeBeatSheetId: string | null;
}

export interface SceneBeatSheetValidationReport extends SceneBeatSheetCommandReport {
  beatSheet: SceneBeatSheetDocument;
}

export type SceneBeatSheetChange =
  | { type: 'sceneBeatSheet.created'; beatSheetId: string; sceneId: string }
  | { type: 'sceneBeatSheet.activeSet'; beatSheetId: string; sceneId: string };

export interface SceneBeatSheetWriteReport extends SceneBeatSheetCommandReport {
  beatSheet: SceneBeatSheetSummary;
  activeBeatSheetId: string;
  changes: SceneBeatSheetChange[];
}

export interface SceneBeatSheetApplyReport extends SceneBeatSheetCommandReport {
  sceneId: string;
  baseBeatSheetId: string;
  createdBeatSheetId: string;
  activatedBeatSheetId: string | null;
  beatSheet: SceneBeatSheetSummary;
  changes: Array<{ type: 'inserted' | 'removed' | 'updated' | 'preserved'; beatIds: string[] }>;
  storyboard: SceneBeatSheetStoryboardStatus;
}

export interface SceneBeatSheetStoryboardStatus extends SceneBeatSheetCommandReport {
  sceneId: string;
  beatSheetId: string;
  beats: Array<{
    beatId: string;
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
  beatSheetId: string;
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

export interface SceneStoryboardImagesImportReport extends SceneBeatSheetCommandReport {
  changes: Array<{ type: string; [key: string]: string }>;
  purpose: 'scene.storyboard-sheet';
  target: { kind: 'scene'; id: string };
  beatSheetId: string;
  imported: Asset[];
  files: SceneStoryboardImagesImportedFile[];
}

export type SceneBeatSheetBlock = ScreenplayBlock;
