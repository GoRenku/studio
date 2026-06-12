import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Block, SceneSetting } from './screenplay.js';

export const DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA = [
  {
    key: 'dramaticEnergy',
    label: 'Dramatic Energy',
    description: 'How strongly the moment pulls the audience forward.',
  },
  {
    key: 'stakes',
    label: 'Stakes',
    description:
      'How clearly the audience understands what can be lost or gained.',
  },
  {
    key: 'characterAgency',
    label: 'Character Agency',
    description: "How clearly a character's choice drives the story.",
  },
] as const satisfies ScreenplayAnalysisCriterion[];

export type DefaultScreenplayAnalysisCriterionKey =
  (typeof DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA)[number]['key'];

export type ScreenplayAnalysisStructureModel = 'threeAct';

export type ScreenplayActRole = 'actOne' | 'actTwo' | 'actThree';

export type ScreenplayBeatRole =
  | 'hook'
  | 'incitingIncident'
  | 'firstPlotPoint'
  | 'firstPinchPoint'
  | 'midpoint'
  | 'secondPinchPoint'
  | 'secondPlotPoint'
  | 'climax'
  | 'resolution';

export interface ScreenplayAnalysisCriterion {
  key: string;
  label: string;
  description: string;
}

export interface ScreenplayAnalysisDocument {
  kind: 'screenplayAnalysis';
  structureModel: ScreenplayAnalysisStructureModel;
  title: string;
  summary: string;
  criteria: ScreenplayAnalysisCriterion[];
  acts: ScreenplayActAnalysis[];
  keyBeats: ScreenplayKeyBeatAnalysis[];
  sequences: ScreenplaySequenceAnalysis[];
  scenes: ScreenplaySceneAnalysis[];
  suggestedSceneAdditions: SuggestedSceneAddition[];
}

export interface ScreenplayActAnalysis {
  actId: string;
  actRole: ScreenplayActRole;
  title: string;
  synopsis: string;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplayKeyBeatAnalysis {
  key: ScreenplayBeatRole;
  label: string;
  actId: string;
  sequenceId?: string;
  sceneId?: string;
  synopsis: string;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplaySequenceAnalysis {
  sequenceId: string;
  actId: string;
  title: string;
  synopsis: string;
  beatRole?: ScreenplayBeatRole;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplaySceneAnalysis {
  sceneId: string;
  sequenceId: string;
  actId: string;
  title: string;
  synopsis: string;
  beatRole?: ScreenplayBeatRole;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplayAnalysisScoreMap {
  [criterionKey: string]: number;
}

export interface ScreenplayAnalysisCritique {
  summary: string;
  strengths?: string[];
  concerns?: string[];
  evidence: ScreenplayAnalysisEvidence[];
  suggestions: string[];
}

export interface ScreenplayAnalysisEvidence {
  sceneId?: string;
  text: string;
}

export interface SuggestedSceneAddition {
  targetActId: string;
  targetSequenceId?: string;
  placement?: SuggestedScenePlacement;
  title: string;
  purpose: string;
  synopsis: string;
  rationale: string;
  expectedCriterionChanges?: SuggestedCriterionChange[];
}

export interface SuggestedScenePlacement {
  beforeSceneId?: string;
  afterSceneId?: string;
}

export interface SuggestedCriterionChange {
  criterionKey: string;
  direction: 'increase' | 'decrease' | 'clarify';
  reason: string;
}

export interface ScreenplayAnalysisProjectReport {
  name: string;
  id?: string;
}

export interface ScreenplayAnalysisSummary {
  id: string;
  structureModel: ScreenplayAnalysisStructureModel;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ScreenplayAnalysisCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: ScreenplayAnalysisProjectReport;
  resourceKeys: string[];
}

export interface ScreenplayAnalysisContextReport
  extends ScreenplayAnalysisCommandReport {
  screenplay: ScreenplayAnalysisContextScreenplay;
  cast: ScreenplayAnalysisContextCastMember[];
  locations: ScreenplayAnalysisContextLocation[];
  defaultCriteria: ScreenplayAnalysisCriterion[];
  activeAnalysis: ScreenplayAnalysisSummary | null;
}

export interface ScreenplayAnalysisContextScreenplay {
  title: string;
  logline?: string;
  summary?: string;
  dramaticQuestion?: string;
  premiseOverview?: string;
  centralConflict?: string;
  themes: string[];
  tone: string[];
  genrePrimary?: string;
  genreSecondary: string[];
  acts: ScreenplayAnalysisContextAct[];
}

export interface ScreenplayAnalysisContextAct {
  id: string;
  title?: string;
  purpose?: string;
  sequences: ScreenplayAnalysisContextSequence[];
}

export interface ScreenplayAnalysisContextSequence {
  id: string;
  title?: string;
  purpose?: string;
  scenes: ScreenplayAnalysisContextScene[];
}

export interface ScreenplayAnalysisContextScene {
  id: string;
  title: string;
  setting: SceneSetting;
  storyFunction: string[];
  blocks: Block[];
}

export interface ScreenplayAnalysisContextCastMember {
  id: string;
  handle: string;
  name: string;
  isVoiceOver: boolean;
  role?: string;
}

export interface ScreenplayAnalysisContextLocation {
  id: string;
  handle: string;
  name: string;
  timePeriod?: string;
}

export interface ScreenplayAnalysisListReport
  extends ScreenplayAnalysisCommandReport {
  analyses: ScreenplayAnalysisSummary[];
  activeAnalysisId: string | null;
}

export interface ScreenplayAnalysisReadReport
  extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysisDocument | null;
  summary: ScreenplayAnalysisSummary | null;
  activeAnalysisId: string | null;
}

export interface ScreenplayAnalysisValidationReport
  extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysisDocument;
}

export type ScreenplayAnalysisChange =
  | { type: 'screenplayAnalysis.created'; analysisId: string }
  | { type: 'screenplayAnalysis.activeSet'; analysisId: string };

export interface ScreenplayAnalysisWriteReport
  extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysisSummary;
  activeAnalysisId: string;
  changes: ScreenplayAnalysisChange[];
}
