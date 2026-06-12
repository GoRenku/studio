import type { SceneShotListContextReport, SceneShotListDocument, SceneShotListSummary } from './scene-shot-list.js';
import type { SceneMediaGenerationTarget } from './media-generation-target.js';
import type { LookbookImageDetail, LookbookImageFrame, LookbookImageOutputFormat } from './lookbook-media-generation.js';
import { SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE } from './media-generation-purpose.js';

export type SceneStoryboardSheetModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type SceneStoryboardSheetFrame = '4:3';

export type SceneStoryboardShotFrame = LookbookImageFrame;

export type SceneStoryboardSheetDetail = LookbookImageDetail;

export type SceneStoryboardSheetOutputFormat = LookbookImageOutputFormat;

export interface SceneStoryboardSheetGenerationContext {
  purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE;
  target: SceneMediaGenerationTarget;
  shotListId: string;
  project: SceneShotListContextReport['project'];
  screenplay: SceneShotListContextReport['screenplay'];
  act: SceneShotListContextReport['act'];
  sequence: SceneShotListContextReport['sequence'];
  scene: SceneShotListContextReport['scene'];
  cast: SceneShotListContextReport['cast'];
  locations: SceneShotListContextReport['locations'];
  activeLookbook: SceneShotListContextReport['activeLookbook'];
  shotList: SceneShotListDocument;
  shotListSummary: SceneShotListSummary;
  defaults: {
    takeCount: 1;
    seed: null;
    sheetFrame: '4:3';
    shotFrame: 'project';
    resolvedShotFrame: string;
    detail: 'standard';
    outputFormat: 'png';
    maxShotsPerSheet: 4;
  };
  resourceKeys: string[];
}

export interface SceneStoryboardSheetGenerationSpec {
  purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE;
  target: SceneMediaGenerationTarget;
  shotListId: string;
  shotIds: string[];
  modelChoice: SceneStoryboardSheetModelChoice;
  prompt: string;
  takeCount?: 1;
  seed?: number | null;
  sheetFrame?: SceneStoryboardSheetFrame;
  shotFrame?: SceneStoryboardShotFrame;
  detail?: SceneStoryboardSheetDetail;
  outputFormat?: SceneStoryboardSheetOutputFormat;
  title?: string;
}

export interface SceneStoryboardSheetModelChoiceReport {
  modelChoice: SceneStoryboardSheetModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportsSeed: boolean;
  takeCount: {
    min: 1;
    max: 1;
    default: 1;
  };
  supportedSheetFrames: SceneStoryboardSheetFrame[];
  supportedShotFrames: SceneStoryboardShotFrame[];
  supportedDetails: SceneStoryboardSheetDetail[];
  supportedOutputFormats: SceneStoryboardSheetOutputFormat[];
}

export interface SceneStoryboardSheetModelListReport {
  purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE;
  target: SceneMediaGenerationTarget;
  shotListId: string;
  models: SceneStoryboardSheetModelChoiceReport[];
}
