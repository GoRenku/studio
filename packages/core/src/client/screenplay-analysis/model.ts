import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CastMember } from '../cast-members.js';
import type { Location } from '../locations.js';
import type { Project } from '../project/index.js';
import type { Prop } from '../props.js';
import type { OpeningElement, Scene, ScreenplayReference } from '../screenplay/index.js';

export type ScreenplayAnalysisId = string;
export type ScreenplayAnalysisStructureModel = 'threeAct';
export type ScreenplayAnalysisActRole = 'actOne' | 'actTwo' | 'actThree';
export type ScreenplayAnalysisBeatRole =
  | 'hook'
  | 'incitingIncident'
  | 'firstPlotPoint'
  | 'firstPinchPoint'
  | 'midpoint'
  | 'secondPinchPoint'
  | 'secondPlotPoint'
  | 'climax'
  | 'resolution';

export interface ScreenplayAnalysis {
  structureModel: ScreenplayAnalysisStructureModel;
  title: string;
  summary: string;
  criteria: ScreenplayAnalysisCriterion[];
  actSegments: ScreenplayAnalysisActSegment[];
  keyBeats: ScreenplayAnalysisKeyBeat[];
  sceneGroups?: ScreenplayAnalysisSceneGroup[];
  sceneAnalyses: ScreenplaySceneAnalysis[];
  suggestedScenes: SuggestedScene[];
}

export interface ScreenplayAnalysisCriterion {
  key: string;
  label: string;
  description: string;
}

export interface ScreenplayAnalysisActSegment {
  role: ScreenplayAnalysisActRole;
  title: string;
  synopsis: string;
  sceneIds: string[];
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplayAnalysisKeyBeat {
  key: ScreenplayAnalysisBeatRole;
  label: string;
  sceneId?: string;
  synopsis: string;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplayAnalysisSceneGroup {
  title: string;
  synopsis: string;
  sceneIds: string[];
  beatRole?: ScreenplayAnalysisBeatRole;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplaySceneAnalysis {
  sceneId: string;
  synopsis: string;
  beatRole?: ScreenplayAnalysisBeatRole;
  scoreByCriterion: ScreenplayAnalysisScoreMap;
  critique: ScreenplayAnalysisCritique;
}

export interface ScreenplayAnalysisScoreMap { [criterionKey: string]: number }

export interface ScreenplayAnalysisCritique {
  summary: string;
  strengths?: string[];
  concerns?: string[];
  evidence: ScreenplayAnalysisEvidence[];
  suggestions: string[];
}

export interface ScreenplayAnalysisEvidence { sceneId?: string; text: string }

export interface SuggestedScene {
  placement: SuggestedScenePlacement;
  title: string;
  purpose: string;
  synopsis: string;
  rationale: string;
  expectedCriterionChanges?: SuggestedCriterionChange[];
}

export type SuggestedScenePlacement =
  | { beforeSceneId: string; afterSceneId?: never }
  | { beforeSceneId?: never; afterSceneId: string };

export interface SuggestedCriterionChange {
  criterionKey: string;
  direction: 'increase' | 'decrease' | 'clarify';
  reason: string;
}

export interface ScreenplayAnalysisSummary {
  id: ScreenplayAnalysisId;
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
  project: { id: string; projectName: string };
  resourceKeys: string[];
}

export interface ScreenplayAnalysisContextReport extends ScreenplayAnalysisCommandReport {
  project: { id: string; projectName: string } & Pick<Project,
    | 'title' | 'logline' | 'synopsis' | 'premise' | 'intendedAudience'
    | 'format' | 'targetRuntimeMinutes' | 'primaryGenre' | 'secondaryGenres'
    | 'tones' | 'contentRatingIntent' | 'creativeBoundaries' | 'centralConflict'
    | 'dramaticQuestion' | 'themes' | 'historicalBasis' | 'dramatizedElements'
    | 'screenplayDraftStatus' | 'researchSources' | 'assumptions'
    | 'openQuestions' | 'nextSteps'
  >;
  screenplay: {
    opening: OpeningElement[];
    scenes: Array<Pick<Scene, 'id' | 'productionNumber' | 'heading' | 'title' | 'blocks'>>;
    references: ScreenplayReference[];
  };
  cast: Array<Pick<CastMember, 'id' | 'handle' | 'name' | 'role' | 'isVoiceOver' | 'age' | 'want' | 'need' | 'arc' | 'description'>>;
  locations: Array<Pick<Location, 'id' | 'handle' | 'name' | 'timePeriod' | 'description'>>;
  props: Array<Pick<Prop, 'id' | 'handle' | 'name' | 'description'>>;
  defaultCriteria: ScreenplayAnalysisCriterion[];
  activeAnalysis: ScreenplayAnalysisSummary | null;
}

export interface ScreenplayAnalysisListReport extends ScreenplayAnalysisCommandReport {
  analyses: ScreenplayAnalysisSummary[];
  activeAnalysisId: ScreenplayAnalysisId | null;
}

export interface ScreenplayAnalysisReadReport extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysis | null;
  summary: ScreenplayAnalysisSummary | null;
  activeAnalysisId: ScreenplayAnalysisId | null;
}

export interface ScreenplayAnalysisValidationReport extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysis;
}

export type ScreenplayAnalysisChange =
  | { type: 'screenplayAnalysis.created'; analysisId: ScreenplayAnalysisId }
  | { type: 'screenplayAnalysis.activeSet'; analysisId: ScreenplayAnalysisId };

export interface ScreenplayAnalysisWriteReport extends ScreenplayAnalysisCommandReport {
  analysis: ScreenplayAnalysisSummary;
  activeAnalysisId: ScreenplayAnalysisId;
  changes: ScreenplayAnalysisChange[];
}

export const DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA = [
  { key: 'dramaticEnergy', label: 'Dramatic Energy', description: 'How strongly the moment pulls the audience forward.' },
  { key: 'stakes', label: 'Stakes', description: 'How clearly the audience understands what can be lost or gained.' },
  { key: 'characterAgency', label: 'Character Agency', description: "How clearly a character's choice drives the story." },
] as const satisfies ScreenplayAnalysisCriterion[];

export type DefaultScreenplayAnalysisCriterionKey = (typeof DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA)[number]['key'];
