import type {
  DiagnosticIssue,
  DiagnosticResult,
} from '@gorenku/studio-diagnostics';

export interface NarrativeStarter {
  kind: 'renku.narrativeStarter';
  version: '0.1.0';
  project: NarrativeStarterProject;
  languages: NarrativeStarterLanguage[];
  visualLanguageCategories?: NarrativeStarterVisualLanguageCategory[];
  visualLanguage?: NarrativeStarterVisualLanguage[];
  cast?: NarrativeStarterCastMember[];
  continuityReferences?: NarrativeStarterContinuityReference[];
  sequences: NarrativeStarterSequence[];
}

export interface NarrativeStarterProject {
  name: string;
  title: string;
  type: 'standaloneMovie' | 'series';
  aspectRatio: string;
  coverFile?: string;
  logline: string;
  summary?: string;
  summaryFile?: string;
}

export interface NarrativeStarterLanguage {
  localeTag: string;
  displayName?: string;
  isBase?: boolean;
  supportsAudio?: boolean;
  supportsSubtitles?: boolean;
}

export interface NarrativeStarterCastMember {
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
  description?: string;
  descriptionFile?: string;
}

export interface NarrativeStarterVisualLanguageCategory {
  name: string;
  description?: string;
}

export interface NarrativeStarterVisualLanguage {
  category: string;
  name: string;
  shortDescription?: string;
  priority: 'default' | 'situational' | 'rare';
  guidance?: string;
  guidanceFile?: string;
  prompt?: string;
  promptFile?: string;
}

export interface NarrativeStarterContinuityReference {
  kind: string;
  name: string;
  shortDescription?: string;
  description?: string;
  descriptionFile?: string;
}

export interface NarrativeStarterSequence {
  title: string;
  shortTitle?: string;
  summary?: string;
  summaryFile?: string;
  scenes?: NarrativeStarterScene[];
}

export interface NarrativeStarterScene {
  title: string;
  summary?: string;
  summaryFile?: string;
  clips?: NarrativeStarterClip[];
}

export interface NarrativeStarterClip {
  title: string;
  summary?: string;
  summaryFile?: string;
  visualIntent?: string;
  visualIntentFile?: string;
}

export interface NarrativeStarterValidation {
  starter: NarrativeStarter | null;
  result: DiagnosticResult;
}

export interface NarrativeStarterReadResult {
  starter: NarrativeStarter;
  result: DiagnosticResult;
  warnings: DiagnosticIssue[];
}
