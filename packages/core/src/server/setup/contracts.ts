import type {
  DiagnosticIssue,
  DiagnosticResult,
} from '@gorenku/studio-diagnostics';

export interface ProjectSetup {
  kind: 'renku.projectSetup';
  version: '0.1.0';
  project: ProjectSetupProject;
  languages?: ProjectSetupLanguage[];
  visualLanguageCategories?: ProjectSetupVisualLanguageCategory[];
  visualLanguage?: ProjectSetupVisualLanguage[];
  cast?: ProjectSetupCastMember[];
  continuityReferences?: ProjectSetupContinuityReference[];
  episodes?: ProjectSetupEpisode[];
  sequences?: ProjectSetupSequence[];
}

export interface ProjectSetupProject {
  name: string;
  title: string;
  type: 'standaloneMovie' | 'series';
  logline?: string;
  summary?: string;
  aspectRatio?: string;
}

export interface ProjectSetupLanguage {
  localeTag: string;
  displayName?: string;
  isBase?: boolean;
  supportsAudio?: boolean;
  supportsSubtitles?: boolean;
}

export interface ProjectSetupVisualLanguage {
  category: string;
  name: string;
  shortDescription?: string;
  priority: 'default' | 'situational' | 'rare';
  guidanceFile?: string;
  promptFile?: string;
  guidance?: string;
  prompt?: string;
}

export interface ProjectSetupVisualLanguageCategory {
  name: string;
  description?: string;
}

export interface ProjectSetupContinuityReference {
  kind: string;
  name: string;
  shortDescription?: string;
  descriptionFile?: string;
  description?: string;
}

export interface ProjectSetupCastMember {
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
  descriptionFile?: string;
  description?: string;
}

export interface ProjectSetupEpisode {
  title: string;
  shortTitle?: string;
  episodeNumber?: number;
  summary?: string;
  sequences?: ProjectSetupSequence[];
}

export interface ProjectSetupSequence {
  title: string;
  shortTitle?: string;
  summary?: string;
  scenes?: ProjectSetupScene[];
}

export interface ProjectSetupScene {
  title: string;
  summary?: string;
  clips?: ProjectSetupClip[];
}

export interface ProjectSetupClip {
  title: string;
  summary?: string;
  visualIntent?: string;
}

export interface ProjectSetupValidation {
  setup: ProjectSetup | null;
  result: DiagnosticResult;
}

export interface ProjectSetupReadResult {
  setup: ProjectSetup;
  result: DiagnosticResult;
  warnings: DiagnosticIssue[];
}
