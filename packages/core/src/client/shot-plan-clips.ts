import type { Asset } from './assets.js';
import type { ShotPlanProjectInput } from './shot-plans.js';

export interface ShotPlanClipTake {
  id: string;
  clipId: string;
  number: number;
  title: string | null;
  assetId: string;
  assetFileId: string;
  sourceTakeId: string | null;
  createdAt: string;
}

export interface ShotPlanClip {
  id: string;
  previsRevisionId: string;
  number: number;
  selectedTakeId: string | null;
  takes: ShotPlanClipTake[];
}

export interface ShotPlanClips {
  project: { projectName: string };
  shotPlanId: string;
  previsRevisionId: string;
  clips: ShotPlanClip[];
  assets: Asset[];
  unassignedAssets: Asset[];
  sources: Array<{ takeId: string; shotPlanId: string; shotPlanTitle: string; revisionNumber: number; clipNumber: number; takeNumber: number; selectedTakeNumber: number | null }>;
  resourceKeys: string[];
}

export interface ReadShotPlanClipsInput extends ShotPlanProjectInput {
  shotPlanId: string;
  previsRevisionId: string;
}
export interface RegisterShotPlanClipTakeInput extends ShotPlanProjectInput {
  clipId: string;
  assetId: string;
  assetFileId: string;
  title?: string | null;
  sourceTakeId?: string | null;
}
export interface SelectShotPlanClipTakeInput extends ShotPlanProjectInput {
  clipId: string;
  takeId: string | null;
}
export interface UpdateShotPlanClipTakeInput extends ShotPlanProjectInput {
  takeId: string;
  title: string | null;
}
export interface ResolveShotPlanClipTakeInput extends ReadShotPlanClipsInput {
  clipNumber: number;
  takeNumber: number;
}

export interface ShotPlanClipCommands {
  readShotPlanClips(input: ReadShotPlanClipsInput): Promise<ShotPlanClips>;
  createShotPlanClip(input: ReadShotPlanClipsInput): Promise<ShotPlanClips>;
  registerShotPlanClipTake(input: RegisterShotPlanClipTakeInput): Promise<ShotPlanClips>;
  selectShotPlanClipTake(input: SelectShotPlanClipTakeInput): Promise<ShotPlanClips>;
  updateShotPlanClipTake(input: UpdateShotPlanClipTakeInput): Promise<ShotPlanClips>;
  resolveShotPlanClipTake(input: ResolveShotPlanClipTakeInput): Promise<ShotPlanClipTake>;
}
