import type { Asset } from './assets.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ShotPlanProjectInput } from './shot-plans.js';

export interface ReadShotPlanPrevisInput extends ShotPlanProjectInput {
  shotPlanId: string;
}

export interface RegisterShotPlanPrevisInput extends ReadShotPlanPrevisInput {
  sourceDirectory: string;
  renderPath: string;
  title?: string;
}

export interface PrevisFrameRate { numerator: number; denominator: number }
export interface PrevisShotSegment { id: string; startFrame: number; label: string }
export interface PrevisSubject { key: string; label: string; color: string }
export interface PrevisDialogueAudio { assetId: string; assetFileId: string; offsetSeconds?: number }
export type PrevisCue =
  | { id: string; kind: 'dialogue'; startFrame: number; endFrame?: number; speaker: string; text: string; audio?: PrevisDialogueAudio }
  | { id: string; kind: 'action'; startFrame: number; subject?: string; text: string }
  | { id: string; kind: 'camera'; startFrame: number; text: string };

export interface PrevisPlayback {
  frameRate: PrevisFrameRate;
  frameCount: number;
  segments: PrevisShotSegment[];
  subjects: PrevisSubject[];
  cues: PrevisCue[];
}

export interface PrevisRevision {
  id: string;
  number: number;
  sourceDirectory: string;
  createdAt: string;
  render: Asset | null;
  description: string | null;
  playback: PrevisPlayback | null;
  generations: Asset[];
  warnings: DiagnosticIssue[];
}

export interface ShotPlanPrevisReport {
  project: { projectName: string; projectFolder: string };
  shotPlanId: string;
  sourceDirectory: string;
  revisions: PrevisRevision[];
  resourceKeys: string[];
}
