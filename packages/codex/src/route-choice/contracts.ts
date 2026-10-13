/**
 * Type-only contracts shared by the Codex Route Chooser runtime and the Studio Route Chooser app.
 * This file is the `@gorenku/studio-codex/route-choice` package export; keep it free of runtime code.
 * Provider ids and model keys are opaque Skill data echoed back on consume.
 */
import type { GenerationLane, GenerationLaneModel, MediaPurpose } from '@gorenku/studio-core/client';

export interface RouteChoiceModelOption {
  key: string;
  name: string;
  recommended: boolean;
}

export interface RouteChoiceProviderOption {
  provider: string;
  label: string;
  /** False when the provider needs an API key that is not saved. */
  available: boolean;
  models: RouteChoiceModelOption[];
}

export interface RouteChoiceSelection {
  provider: string;
  /** A model key from the provider's options. */
  model: string;
}

export type RouteChoiceAnswer =
  | { kind: 'chosen'; provider: string; model: string }
  | { kind: 'canceled' };

export interface RouteChooser {
  choiceId: string;
  revision: number;
  lane: GenerationLane;
  laneLabel: string;
  purpose: MediaPurpose;
  providers: RouteChoiceProviderOption[];
  /** The lane default, the agent's suggestion, or the recommendation; null when nothing is available. */
  preselected: RouteChoiceSelection | null;
  chooseRouteBeforeGenerating: boolean;
  answer: RouteChoiceAnswer | null;
}

export interface RouteChooseInput {
  project: string;
  purpose: MediaPurpose;
  lane: GenerationLane;
  suggested?: { provider: string; model: string };
}

export interface RouteRespondInput {
  choiceId: string;
  choice: RouteChoiceAnswer;
  saveAsLaneDefault: boolean;
  chooseRouteBeforeGenerating: boolean;
}

export interface RouteConsumeInput {
  choiceId: string;
}

export type RouteConsumeResult =
  | {
    status: 'chosen';
    choiceId: string;
    chosen: { provider: string; providerLabel: string; model: GenerationLaneModel };
    laneSettingsChanged: boolean;
  }
  | { status: 'canceled'; choiceId: string }
  | { status: 'alreadyConsumed'; choiceId: string };
