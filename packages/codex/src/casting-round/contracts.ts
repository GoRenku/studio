/**
 * Type-only contracts shared by the Codex Casting round runtime and the Studio Casting round app.
 * This file is the `@gorenku/studio-codex/casting-round` package export; keep it free of runtime code.
 * Provider ids and model keys are opaque Skill data echoed back on consume.
 */
import type { CastCastingResource, CastingEstimatedCost, CastingModelEstimate, CastingProviderEstimate, CastingRoute, ImageDetailLevel } from '@gorenku/studio-core/client';

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

/** A costume offered in a character sheet round panel. */
export interface CastingRoundCostume {
  id: string;
  name: string;
  sceneIds: string[];
  /** Sheets already in the costume's rounds, hidden ones included. */
  sheetCount: number;
  picked: boolean;
}

/** What the panel's round is for: one Look's casting candidates, or character sheets for some of a Look's costumes. */
export type CastingRoundSubject =
  | { kind: 'look'; look: { id: string; name: string } }
  | { kind: 'costumes'; look: { id: string; name: string }; scenes: CastCastingResource['scenes']; costumes: CastingRoundCostume[] };

export type CastingRoundSubjectInput = { kind: 'look'; lookId: string } | { kind: 'costumes'; costumeIds: string[] };

export type CastingRoundAnswer =
  | {
    kind: 'generate';
    /** Per round: for costumes, every ticked costume gets these routes. */
    routes: CastingRoute[];
    maxConcurrentGenerations: number;
    /** The detail level every image of the round is generated at. */
    detail: ImageDetailLevel;
    /** The ticked costumes, one round each; only for a costumes subject. */
    costumeIds?: string[];
    /** Provider charges summed over every round; null when any route has no price or none is charged. */
    estimatedCost: CastingEstimatedCost | null;
    defaultsSaved: boolean;
  }
  | { kind: 'canceled' };

export interface CastingRound {
  panelId: string;
  revision: number;
  castMember: { id: string; name: string };
  subject: CastingRoundSubject;
  /** Display lines supplied by the agent; opaque and never stored. */
  brief: string[];
  references: CastingRoundReference[];
  options: CastingRoundModelOption[];
  /** Ticked models and counts when the panel opens: the agent's suggestion, the subject's saved defaults, or the image lane default. */
  preselected: CastingRoute[];
  /** The total stepper's starting value: images per round. */
  initialTotal: number;
  /** The highest count one model can take in a round. */
  maxCountPerModel: number;
  /** The image lane's concurrency. */
  maxConcurrentGenerations: number;
  /** The detail level the panel opens on: the Project's candidate or character sheet detail. */
  initialDetail: ImageDetailLevel;
  answer: CastingRoundAnswer | null;
}

export interface CastingRoundOpenInput {
  project: string;
  subject: CastingRoundSubjectInput;
  brief: string[];
  /** One-line strength notes keyed by Default Model List model key. */
  notes?: Record<string, string>;
  /** Identity reference Asset File ids; a costumes subject defaults to the Look's cast candidate. */
  references?: string[];
  suggested?: CastingRoute[];
}

export interface CastingRoundRespondInput {
  panelId: string;
  choice:
    | { kind: 'generate'; routes: CastingRoute[]; maxConcurrentGenerations: number; detail: ImageDetailLevel; costumeIds?: string[] }
    | { kind: 'canceled' };
  saveAsDefaults: boolean;
}

export interface CastingRoundConsumeInput {
  panelId: string;
}

export type CastingRoundConsumeResult =
  | {
    status: 'generate';
    panelId: string;
    /** Create one round per Look or costume with `renku cast casting round create`. */
    subject: { kind: 'look'; lookId: string } | { kind: 'costumes'; costumeIds: string[] };
    /** The routes of each round. */
    routes: CastingRoute[];
    maxConcurrentGenerations: number;
    /** Apply this level's native fields from the Default Model List to every image request. */
    detail: ImageDetailLevel;
    referenceAssetFileIds: string[];
    /** The estimate of one round, stored with each round. */
    estimatedCost: CastingEstimatedCost | null;
  }
  | { status: 'canceled'; panelId: string }
  | { status: 'alreadyConsumed'; panelId: string };
