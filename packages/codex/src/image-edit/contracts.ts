/**
 * Type-only contracts shared by the Codex image edit runtime and the Studio image edit apps.
 * This file is the `@gorenku/studio-codex/image-edit` package export; keep it free of runtime code.
 */

export type ImageEditPanel = 'flux-3';
export type ImageEditRegionMode = 'edit' | 'remove';
export type ImageEditResolution = '1k' | '2k' | '4k';

/** A rectangle on the model's 0–1000 grid, origin top-left. */
export interface ImageEditRegionBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface ImageEditRegion {
  number: number;
  mode: ImageEditRegionMode;
  box: ImageEditRegionBox;
  instruction: string;
}

/** Opaque provider and route ids, echoed back on consume. */
export interface ImageEditRoute {
  provider: string;
  model: string;
}

export interface ImageEditOwner {
  kind: string;
  name: string | null;
}

export interface ImageEditVersion {
  assetFileId: string;
  takeNumber: number;
  imageUri: string;
  /** The version this one was edited from in this session; null for the source and outside versions. */
  parentAssetFileId: string | null;
  selected: boolean;
}

export interface ImageEditStyleReference {
  assetFileId: string;
  name: string | null;
  lookbook: 'production' | 'storyboard';
  lookbookName: string;
  imageUri: string;
}

export interface ImageEditAction {
  actionId: string;
  baseAssetFileId: string;
  status: 'pending' | 'running' | 'failed';
  message?: string;
}

export interface ImageEditInitial {
  wholeImageInstruction: string;
  resolution: ImageEditResolution;
}

export interface ImageEditSession {
  sessionId: string;
  revision: number;
  panel: ImageEditPanel;
  route: ImageEditRoute;
  owner: ImageEditOwner;
  /** The Asset File type of every version; Studio maps it to a label. */
  imageType: string;
  selectable: boolean;
  /** Source first, then versions made in this session; deleted versions are dropped. */
  versions: ImageEditVersion[];
  /** The version the next edit starts from, or null when a selectable image has no selection. */
  editBaseAssetFileId: string | null;
  styleReferences: ImageEditStyleReference[];
  action: ImageEditAction | null;
  lastCompletedAction: { actionId: string; assetFileId: string } | null;
  initial: ImageEditInitial;
}

export interface Flux3ImageEditDraft {
  panel: 'flux-3';
  baseAssetFileId: string;
  wholeImageInstruction: string;
  styleReferenceAssetFileId: string | null;
  regions: ImageEditRegion[];
  resolution: ImageEditResolution;
}

export type ImageEditDraft = Flux3ImageEditDraft;

export interface Flux3ImageEditOpenInput {
  project: string;
  sourceAssetFileId: string;
  route: ImageEditRoute;
  wholeImageInstruction: string;
  resolution: ImageEditResolution;
}

export interface ImageEditGenerateInput {
  sessionId: string;
  draft: ImageEditDraft;
}

export interface ImageEditGenerateReceipt {
  sessionId: string;
  actionId: string;
  session: ImageEditSession;
}

export interface ImageEditConsumeInput {
  sessionId: string;
  actionId: string;
}

export type ImageEditConsumeResult =
  | {
    status: 'consumed';
    sessionId: string;
    actionId: string;
    project: string;
    provider: string;
    model: string;
    base: { assetFileId: string; projectRelativePath: string };
    styleReference: { assetFileId: string; projectRelativePath: string; name: string | null } | null;
    draft: ImageEditDraft;
  }
  | { status: 'alreadyConsumed'; sessionId: string; actionId: string };

export type ImageEditReportOutcome =
  | { status: 'attached'; assetFileId: string }
  | { status: 'failed'; message: string };

export interface ImageEditReportInput {
  sessionId: string;
  actionId: string;
  outcome: ImageEditReportOutcome;
}

export interface ImageEditTargetCandidate {
  assetFileId: string;
  owner: ImageEditOwner;
  imageType: string;
  takeNumber: number;
  selected: boolean;
  createdAt: string;
  imageUri: string;
}

export type ImageEditTargetChoice = { status: 'chosen'; assetFileId: string } | { status: 'canceled' };

export interface ImageEditTargetChooser {
  chooserId: string;
  revision: number;
  candidates: ImageEditTargetCandidate[];
  suggestedAssetFileId: string;
  choice: ImageEditTargetChoice | null;
}

export interface ImageEditTargetChooseInput {
  project: string;
  assetFileIds: string[];
  suggestedAssetFileId: string;
}

export interface ImageEditTargetRespondInput {
  chooserId: string;
  choice: ImageEditTargetChoice;
}

export type ImageEditTargetConsumeResult =
  | { status: 'chosen'; chooserId: string; project: string; assetFileId: string }
  | { status: 'canceled'; chooserId: string }
  | { status: 'alreadyConsumed'; chooserId: string };
