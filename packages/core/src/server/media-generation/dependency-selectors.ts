import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  Asset,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencySelectedAsset,
  MediaGenerationDependencySlot,
  ShotVideoTakeGenerationSpec,
} from '../../client/index.js';
import { SHOT_VIDEO_TAKE_GENERATION_PURPOSE } from '../../client/index.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import { listLookbookSheets } from '../database/access/lookbook-sheets.js';
import { readLocationEnvironmentSheetByAssetId } from '../database/access/location-environment-sheets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type MediaGenerationDependencySelectorResult =
  | {
      state: 'satisfied';
      asset: MediaGenerationDependencySelectedAsset;
      diagnostics: DiagnosticIssue[];
    }
  | {
      state: 'missing';
      asset: null;
      diagnostics: DiagnosticIssue[];
    }
  | {
      state: 'invalid-selection';
      asset: null;
      diagnostics: DiagnosticIssue[];
    };

export function resolveMediaGenerationDependencySelection(input: {
  request?: MediaGenerationDependencyRequest;
  session: DatabaseSession;
  slot: MediaGenerationDependencySlot;
}): MediaGenerationDependencySelectorResult {
  if (input.slot.selector.kind === 'shot-video-input') {
    return shotVideoInputAssetFromRequest(input.request, input.slot);
  }
  if (input.slot.selector.kind === 'asset-relationship') {
    return selectedAssetForTarget(input.session, {
      target: input.slot.selector.target,
      role: input.slot.selector.role,
      mediaKind: input.slot.selector.mediaKind,
      slot: input.slot,
      fileRole: input.slot.selector.fileRole,
    });
  }
  if (input.slot.selector.kind === 'lookbook-sheet') {
    const sheet = listLookbookSheets(
      input.session,
      input.slot.selector.lookbookId
    )[0];
    const file = sheet?.asset.files.find((candidate) => candidate.mediaKind === 'image');
    if (sheet && !file) {
      return invalidSelection(
        input.slot,
        'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
        `Selected Lookbook sheet has no image file: ${sheet.asset.assetId}.`,
        'Import or regenerate the Lookbook sheet image before using it as a dependency.'
      );
    }
    return sheet && file
      ? withAsset({
          assetId: sheet.asset.assetId,
          assetFileId: file.id,
          projectRelativePath: file.projectRelativePath,
        })
      : noAsset();
  }
  return noAsset();
}

function shotVideoInputAssetFromRequest(
  request: MediaGenerationDependencyRequest | undefined,
  slot: MediaGenerationDependencySlot
): MediaGenerationDependencySelectorResult {
  if (request?.kind !== 'media-generation-spec') {
    return noAsset();
  }
  const spec = request.spec as ShotVideoTakeGenerationSpec | undefined;
  if (spec?.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    return noAsset();
  }
  const selectedInputs = spec.inputs.filter((candidate) =>
    shotVideoInputMatchesDependencySlot(candidate, slot)
  );
  if (selectedInputs.length > 1) {
    return invalidSelection(
      slot,
      'CORE_MEDIA_DEPENDENCY_AMBIGUOUS_SELECTED_ASSET',
      `Dependency selector found multiple matching shot video inputs for ${slot.label}.`,
      'Keep exactly one selected input for this dependency slot.'
    );
  }
  const input = selectedInputs[0];
  if (!input) {
    return noAsset();
  }
  if (!input.assetId || !input.assetFileId) {
    return invalidSelection(
      slot,
      'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
      `Selected shot video input has no image asset file for ${slot.label}.`,
      'Select or import an image-backed input before using it as a dependency.'
    );
  }
  return withAsset({
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    projectRelativePath: input.projectRelativePath,
  });
}

function shotVideoInputMatchesDependencySlot(
  input: ShotVideoTakeGenerationSpec['inputs'][number],
  slot: MediaGenerationDependencySlot
): boolean {
  if (slot.selector.kind !== 'shot-video-input') {
    return false;
  }
  return (
    input.kind === slot.selector.inputKind &&
    input.mediaKind === 'image' &&
    (!slot.selector.subjectKind || input.subjectKind === slot.selector.subjectKind) &&
    (!slot.selector.subjectId || input.subjectId === slot.selector.subjectId)
  );
}

function selectedAssetForTarget(
  session: DatabaseSession,
  input: {
    target: Parameters<typeof listAssetRelationshipPage>[1]['target'];
    role: string;
    mediaKind: string;
    slot: MediaGenerationDependencySlot;
    fileRole?: string;
  }
): MediaGenerationDependencySelectorResult {
  const selectedAssets = listAssetRelationshipPage(session, {
    target: input.target,
    role: input.role,
    mediaKind: input.mediaKind,
    selection: 'select',
    limit: MAX_RESOURCE_PAGE_LIMIT,
  }).items;
  if (selectedAssets.length > 1) {
    return invalidSelection(
      input.slot,
      'CORE_MEDIA_DEPENDENCY_AMBIGUOUS_SELECTED_ASSET',
      `Dependency selector found multiple selected assets for ${input.slot.label}.`,
      'Keep exactly one selected asset for this dependency.'
    );
  }
  const asset = selectedAssets[0] ?? listAssetRelationshipPage(session, {
    target: input.target,
    role: input.role,
    mediaKind: input.mediaKind,
    limit: MAX_RESOURCE_PAGE_LIMIT,
  }).items[0];
  if (!asset) {
    return noAsset();
  }
  const file = dependencyFile(session, asset, input.mediaKind, input.fileRole);
  if (!file) {
    return invalidSelection(
      input.slot,
      'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
      `Selected asset has no required ${input.mediaKind} file for ${input.slot.label}: ${asset.assetId}.`,
      'Import or regenerate the selected asset before using it as a dependency.'
    );
  }
  return withAsset({
    assetId: asset.assetId,
    assetFileId: file.id,
    projectRelativePath: file.projectRelativePath,
  });
}

function dependencyFile(
  session: DatabaseSession,
  asset: Asset,
  mediaKind: string,
  fileRole?: string
): Asset['files'][number] | undefined {
  if (fileRole === 'composite') {
    const sheet = readLocationEnvironmentSheetByAssetId(session, asset.assetId);
    const compositeFileId = sheet?.compositeFileId ?? null;
    return asset.files.find(
      (candidate) =>
        candidate.id === compositeFileId &&
        candidate.role === 'composite' &&
        candidate.mediaKind === mediaKind
    );
  }
  return asset.files.find((candidate) => candidate.mediaKind === mediaKind);
}

function withAsset(
  asset: MediaGenerationDependencySelectedAsset
): MediaGenerationDependencySelectorResult {
  return { state: 'satisfied', asset, diagnostics: [] };
}

function noAsset(): MediaGenerationDependencySelectorResult {
  return { state: 'missing', asset: null, diagnostics: [] };
}

function invalidSelection(
  slot: MediaGenerationDependencySlot,
  code: string,
  message: string,
  suggestion: string
): MediaGenerationDependencySelectorResult {
  return {
    state: 'invalid-selection',
    asset: null,
    diagnostics: [
      createDiagnosticError(
        code,
        message,
        { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
        suggestion
      ),
    ],
  };
}
