import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { AssetFile } from '../asset-files.js';
import type { CastMemberId } from '../cast-members.js';
import type { ImageDetailLevel } from '../default-models.js';
import type { GenerationLaneModel } from '../project-settings.js';
import type { SceneId } from '../screenplay/organization.js';

/**
 * A Cast Look is one way a Cast Member appears on screen for part of the film,
 * such as a younger age or a large change in physique. The same person is one
 * Cast Member at every age; each age is a Look.
 */
export interface CastLook {
  id: string;
  castMemberId: CastMemberId;
  name: string;
  description: string | null;
  sceneIds: SceneId[];
  /** The `casting_candidate` the director cast for this Look. */
  castCandidateAssetFileId: string | null;
}

/** A costume a Look wears in a set of scenes; each costume gets its own Character Sheet. */
export interface CastCostume {
  id: string;
  castMemberId: CastMemberId;
  lookId: string;
  name: string;
  wardrobe: string[];
  continuityNotes: string[];
  sceneIds: SceneId[];
  /** The `character_sheet` picked for this costume. */
  characterSheetAssetFileId: string | null;
}

/** One model and how many candidates it generates in a Casting Round. */
export interface CastingRoute {
  /** Opaque Skill provider id, echoed back. */
  provider: string;
  model: GenerationLaneModel;
  count: number;
}

export interface CastingEstimatedCost {
  amount: number;
  currency: string;
}

export interface CastingRound {
  id: string;
  lookId: string;
  number: number;
  routes: CastingRoute[];
  maxConcurrentGenerations: number;
  referenceAssetFileIds: string[];
  estimatedCost: CastingEstimatedCost | null;
  createdAt: string;
}

export const CASTING_CANDIDATE_STATUSES = ['candidate', 'hidden'] as const;

export type CastingCandidateStatus = (typeof CASTING_CANDIDATE_STATUSES)[number];

export interface CastingCandidate {
  assetFileId: string;
  roundId: string;
  status: CastingCandidateStatus;
  /** The round route's Skill model key that generated it. */
  modelKey: string;
}

export interface CastLooksPlanDocument {
  kind: 'castLooksPlan';
  castMemberId: CastMemberId;
  looks: Array<{
    /** Keeps an existing Look; omit to add a new one. */
    id?: string;
    name: string;
    description?: string;
    sceneIds: SceneId[];
  }>;
}

export interface CastWardrobePlanDocument {
  kind: 'castWardrobePlan';
  castMemberId: CastMemberId;
  costumes: Array<{
    /** Keeps an existing costume; omit to add a new one. */
    id?: string;
    name: string;
    lookId: string;
    wardrobe: string[];
    continuityNotes: string[];
    sceneIds: SceneId[];
  }>;
}

export interface CastingRoundCreateDocument {
  kind: 'castingRoundCreate';
  lookId: string;
  routes: CastingRoute[];
  maxConcurrentGenerations: number;
  referenceAssetFileIds: string[];
  estimatedCost: CastingEstimatedCost | null;
}

/** Project-level casting defaults that pre-fill the Casting Round panel. */
export interface CastingSettings {
  routes: CastingRoute[];
  /** Detail of casting candidates; low by default, since all but one are discarded. */
  candidateDetail: ImageDetailLevel;
  /** Detail of character sheets, which are kept as identity references. */
  characterSheetDetail: ImageDetailLevel;
}

export interface CastingRoundView extends CastingRound {
  /** Sum of route counts. */
  expectedCount: number;
  candidates: Array<CastingCandidate & { assetFile: AssetFile; model: GenerationLaneModel }>;
}

/** Everything the Casting tab and the casting board show for one Cast Member. */
export interface CastCastingResource {
  castMember: { id: CastMemberId; name: string };
  scenes: Array<{ id: SceneId; productionNumber?: string; heading: string }>;
  looks: Array<CastLook & { rounds: CastingRoundView[]; castCandidate: AssetFile | null }>;
  costumes: CastCostume[];
  /** Every active Character Sheet of the Cast Member; any of them can be picked for a costume. */
  characterSheets: AssetFile[];
}

interface CastingReportBase {
  valid: true;
  warnings: DiagnosticIssue[];
  project: { id: string; projectName: string };
  resourceKeys: string[];
}

export interface CastLooksReport extends CastingReportBase {
  castMemberId: CastMemberId;
  looks: CastLook[];
}

export interface CastWardrobeReport extends CastingReportBase {
  castMemberId: CastMemberId;
  costumes: CastCostume[];
  /** Costumes removed by a write whose picked sheet selection was cleared. */
  clearedSheetSelections: string[];
}

export interface CastingRoundReport extends CastingReportBase {
  round: CastingRound;
}

export interface CastingLookReport extends CastingReportBase {
  look: CastLook;
  rounds: CastingRoundView[];
}

export interface CastingCandidateStatusReport extends CastingReportBase {
  candidate: CastingCandidate;
}

export interface CastingSettingsReport extends CastingReportBase {
  casting: CastingSettings;
}
