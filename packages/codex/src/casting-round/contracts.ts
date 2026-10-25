/**
 * Type-only contracts shared by the Codex Casting round runtime and the Studio Casting round app.
 * This file is the `@gorenku/studio-codex/casting-round` package export; keep it free of runtime code.
 * Provider ids and model keys are opaque Skill data echoed back on consume.
 */
import type { CastingEstimatedCost, CastingModelEstimate, CastingProviderEstimate, CastingRoute, ImageDetailLevel } from '@gorenku/studio-core/client';

/** One provider with a saved key that offers a model, priced for one image at each detail level. */
export interface CastingRoundProviderOption extends CastingProviderEstimate {
  providerLabel: string;
}

/** One model of the Skill's Default Model List image lane, with the providers that can run it. */
export interface CastingRoundModelOption extends CastingModelEstimate {
  /** The Skill's one-line strength note for this model, passed by the agent; null when none. */
  note: string | null;
  /** The image lane's provider first when it offers the model, then the Skill's recommendation, then list order. */
  providers: CastingRoundProviderOption[];
}

export interface CastingRoundReference {
  assetFileId: string;
  imageUri: string;
}

export type CastingRoundAnswer =
  | {
    kind: 'generate';
    routes: CastingRoute[];
    maxConcurrentGenerations: number;
    /** The detail level every candidate of the round is generated at. */
    detail: ImageDetailLevel;
    /** Provider charges summed from the per-image estimates; null when any route has no price or none is charged. */
    estimatedCost: CastingEstimatedCost | null;
    castingDefaultsSaved: boolean;
  }
  | { kind: 'canceled' };

export interface CastingRound {
  panelId: string;
  revision: number;
  castMember: { id: string; name: string };
  look: { id: string; name: string };
  /** Display lines supplied by the agent; opaque and never stored. */
  brief: string[];
  references: CastingRoundReference[];
  options: CastingRoundModelOption[];
  /** Ticked models and counts when the panel opens: the agent's suggestion, the casting defaults, or the image lane default. */
  preselected: CastingRoute[];
  /** The total stepper's starting value. */
  initialTotal: number;
  /** The highest count one model can take in a round. */
  maxCountPerModel: number;
  /** The image lane's concurrency. */
  maxConcurrentGenerations: number;
  /** The detail level the panel opens on: the Project's candidate detail. */
  initialDetail: ImageDetailLevel;
  answer: CastingRoundAnswer | null;
}

export interface CastingRoundOpenInput {
  project: string;
  lookId: string;
  brief: string[];
  /** One-line strength notes keyed by Default Model List model key. */
  notes?: Record<string, string>;
  /** Identity reference Asset File ids. */
  references?: string[];
  suggested?: CastingRoute[];
}

export interface CastingRoundRespondInput {
  panelId: string;
  choice:
    | { kind: 'generate'; routes: CastingRoute[]; maxConcurrentGenerations: number; detail: ImageDetailLevel }
    | { kind: 'canceled' };
  saveAsCastingDefaults: boolean;
}

export interface CastingRoundConsumeInput {
  panelId: string;
}

export type CastingRoundConsumeResult =
  | {
    status: 'generate';
    panelId: string;
    lookId: string;
    routes: CastingRoute[];
    maxConcurrentGenerations: number;
    /** Apply this level's native fields from the Default Model List to every candidate request. */
    detail: ImageDetailLevel;
    referenceAssetFileIds: string[];
    estimatedCost: CastingEstimatedCost | null;
  }
  | { status: 'canceled'; panelId: string }
  | { status: 'alreadyConsumed'; panelId: string };
