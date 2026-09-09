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

export interface PrevisPlayback {
  subjects: Array<{ key: string; label: string; color: string }>;
  cues: Array<{
    startSeconds: number;
    endSeconds?: number;
    subject?: string;
    text: string;
    audio?: { assetId: string; assetFileId: string; offsetSeconds?: number };
  }>;
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
