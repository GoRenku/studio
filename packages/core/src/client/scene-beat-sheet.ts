import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Block, SceneSetting } from './screenplay.js';

export interface SceneBeatSheetDocument {
  kind: 'sceneBeatSheet';
  sceneId: string;
  title: string;
  summary: string;
  narrativeProgression: string;
  baseBeatSheetId?: string | null;
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
  screenplayBlockIndexes: number[];
}

export interface SceneBeatSheetOperationDocument {
  kind: 'sceneBeatSheetOperations';
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
  | {
      operation: 'beats.insert';
      placement:
        | { position: 'start' }
        | { position: 'end' }
        | { position: 'before'; beatId: string }
        | { position: 'after'; beatId: string };
      beats: Beat[];
      storyboardPolicy?: SceneBeatSheetStoryboardPolicy;
    }
  | {
      operation: 'beats.replace';
      beatIds: string[];
      beats: Beat[];
      storyboardPolicy?: SceneBeatSheetStoryboardPolicy;
    }
  | {
      operation: 'beat.update';
      beat: Beat;
      storyboardPolicy?: SceneBeatSheetStoryboardPolicy;
    }
  | {
      operation: 'beats.delete';
      beatIds: string[];
    }
  | {
      operation: 'beatSheet.replace';
      beats: Beat[];
      storyboardPolicy?: SceneBeatSheetStoryboardPolicy;
    };

export type SceneBeatSheetStoryboardPolicy =
  | 'generate'
  | 'reuse-if-unchanged'
  | 'missing-only';

export interface SceneBeatSheetProjectReport {
  name: string;
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
  baseBeatSheetId?: string | null;
}

export interface SceneBeatSheetCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: SceneBeatSheetProjectReport;
  resourceKeys: string[];
}

export interface SceneBeatSheetContextReport
  extends SceneBeatSheetCommandReport {
  project: SceneBeatSheetProjectReport & {
    title: string;
    aspectRatio: string | null;
  };
  screenplay: {
    title: string;
    logline?: string;
    summary?: string;
    genrePrimary?: string;
    genreSecondary?: string[];
    tone?: string[];
    themes?: string[];
  };
  act: { id: string; title?: string; purpose?: string };
  sequence: { id: string; title?: string; purpose?: string };
  scene: {
    id: string;
    title: string;
    setting: SceneSetting;
    storyFunction: string[];
    blocks: Block[];
  };
  cast: Array<{
    id: string;
    handle: string;
    name: string;
    isVoiceOver: boolean;
    role?: string;
    description?: string;
  }>;
  locations: Array<{
    id: string;
    handle: string;
    name: string;
    timePeriod?: string;
    description?: string;
    visualNotes?: string;
  }>;
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

export interface SceneBeatSheetValidationReport
  extends SceneBeatSheetCommandReport {
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
  changes: SceneBeatSheetApplyChange[];
  storyboard: SceneBeatSheetStoryboardStatus;
}

export interface SceneBeatSheetApplyChange {
  type: 'inserted' | 'removed' | 'updated' | 'preserved';
  beatIds: string[];
}

export interface SceneBeatSheetStoryboardStatus
  extends SceneBeatSheetCommandReport {
  sceneId: string;
  beatSheetId: string;
  beats: SceneBeatSheetStoryboardBeatStatus[];
  missingBeatIds: string[];
  staleBeatIds: string[];
  readyBeatIds: string[];
}

export interface SceneBeatSheetStoryboardBeatStatus {
  beatId: string;
  image: null | {
    storyboardImageId: string;
    assetId: string;
    assetFileId: string;
    sourcePurpose: string;
    isCurrentForBeat: boolean;
    simulated?: boolean;
  };
  needsStoryboardImage: boolean;
  reason?: 'missing' | 'beat-changed' | 'narrative-changed';
}

export interface SceneStoryboardImagesImportDocument {
  kind: 'sceneStoryboardImagesImport';
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

export interface SceneStoryboardImagesImportReport
  extends SceneBeatSheetCommandReport {
  changes: Array<{ type: string; [key: string]: string }>;
  purpose: 'scene.storyboard-sheet';
  target: { kind: 'scene'; id: string };
  beatSheetId: string;
  storyboardImageIds: string[];
  imported: import('./assets.js').Asset[];
  files: SceneStoryboardImagesImportedFile[];
}
