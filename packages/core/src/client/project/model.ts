import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type ProjectId = string;
export type ProjectRelativePath = string & {
  readonly __brand: 'ProjectRelativePath';
};

export interface Project {
  id: ProjectId;
  projectName: string;
  title: string;
  aspectRatio: string;
  coverImage: ProjectCoverImage | null;
  logline?: string;
  synopsis?: string;
  premise?: string;
  intendedAudience?: string;
  format?: string;
  targetRuntimeMinutes?: number;
  primaryGenre?: string;
  secondaryGenres?: string[];
  tones?: string[];
  contentRatingIntent?: string;
  creativeBoundaries?: string[];
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
  dramatizedElements?: string[];
  screenplayDraftStatus?: string;
  researchSources?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  nextSteps?: string[];
  counts: ProjectCounts;
}

export interface ProjectCoverImage {
  fileName: 'cover.png';
}

export interface ProjectCounts {
  languages: number;
  castMembers: number;
  locations: number;
  props: number;
  acts: number;
  sequences: number;
  scenes: number;
}

export interface ProjectCreateReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
  coverPath: string | null;
  created: ProjectCounts;
  warnings: DiagnosticIssue[];
}

export interface ProjectCreateRequest {
  projectName: string;
  title: string;
}

export interface ProjectDeleteReport {
  projectName: string;
  projectPath: string;
  deleted: true;
}
