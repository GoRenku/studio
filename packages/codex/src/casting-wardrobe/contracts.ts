/**
 * Type-only contracts shared by the Codex Looks and wardrobe runtime and the Studio Looks and wardrobe app.
 * This file is the `@gorenku/studio-codex/casting-wardrobe` package export; keep it free of runtime code.
 * The panel edits a draft only; the agent validates and writes it with the CLI.
 */
import type { CastCastingResource, CastLooksPlanDocument, CastWardrobePlanDocument } from '@gorenku/studio-core/client';

export type CastingWardrobeMode = 'looks' | 'costumes';

export type CastingWardrobeDraft = CastLooksPlanDocument | CastWardrobePlanDocument;

export type CastingWardrobeAnswer =
  | { kind: 'send'; draft: CastingWardrobeDraft }
  | { kind: 'canceled' };

interface CastingWardrobeBase {
  panelId: string;
  revision: number;
  castMember: { id: string; name: string };
  /** Every scene in screenplay order. */
  scenes: CastCastingResource['scenes'];
  /** The Cast Member's saved Looks, with the cast candidate image when cast. */
  looks: Array<{ id: string; name: string; sceneIds: string[]; castImageUri: string | null }>;
  answer: CastingWardrobeAnswer | null;
}

export interface CastingLooksPanel extends CastingWardrobeBase {
  mode: 'looks';
  draft: CastLooksPlanDocument;
}

export interface CastingCostumesPanel extends CastingWardrobeBase {
  mode: 'costumes';
  draft: CastWardrobePlanDocument;
  /** Saved costumes that already have a picked Character Sheet. */
  sheetPickedCostumeIds: string[];
}

export type CastingWardrobePanel = CastingLooksPanel | CastingCostumesPanel;

export type CastingWardrobeOpenInput =
  | { project: string; mode: 'looks'; castMemberId: string; draft: CastLooksPlanDocument }
  | { project: string; mode: 'costumes'; castMemberId: string; draft: CastWardrobePlanDocument };

export interface CastingWardrobeRespondInput {
  panelId: string;
  choice: { kind: 'send'; draft: CastingWardrobeDraft } | { kind: 'canceled' };
}

export interface CastingWardrobeConsumeInput {
  panelId: string;
}

export type CastingWardrobeConsumeResult =
  | { status: 'sent'; panelId: string; mode: 'looks'; draft: CastLooksPlanDocument }
  | { status: 'sent'; panelId: string; mode: 'costumes'; draft: CastWardrobePlanDocument }
  | { status: 'canceled'; panelId: string }
  | { status: 'alreadyConsumed'; panelId: string };
