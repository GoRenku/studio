import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  Asset,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencySelectedAsset,
  MediaGenerationDependencySlot,
  ShotVideoTakeOutputGenerationSpec,
} from '../../client/index.js';
import { SHOT_VIDEO_TAKE_GENERATION_PURPOSE } from '../../client/index.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import { listLookbookSheets } from '../database/access/lookbook-sheets.js';
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
        assetId: input.slot.selector.assetId,
        role: input.slot.selector.role,
        mediaKind: input.slot.selector.mediaKind,
        slot: input.slot,
      fileRole: input.slot.selector.fileRole,
      selectionPolicy: input.slot.selector.selectionPolicy,
    });
  }
  if (input.slot.selector.kind === 'lookbook-sheet') {
    const sheets = listLookbookSheets(input.session, input.slot.selector.lookbookId);
    const sheet = selectLookbookSheet({
      sheets,
      lookbookSheetId: input.slot.selector.lookbookSheetId,
      selectionPolicy: input.slot.selector.selectionPolicy,
    });
    if (sheet === 'invalid-selected-sheet') {
      return invalidSelection(
        input.slot,
        'CORE_MEDIA_DEPENDENCY_LOOKBOOK_SHEET_SELECTION_INVALID',
        `Selected Lookbook sheet is not available for ${input.slot.label}.`,
        'Select an existing Lookbook sheet or clear the stale selection.'
      );
    }
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
  if (input.slot.selector.kind === 'manual-attachment') {
    return noAsset();
  }
  return invalidSelection(
    input.slot,
    'CORE_MEDIA_DEPENDENCY_SELECTOR_KIND_UNHANDLED',
    `Dependency selector kind is not handled for ${input.slot.label}.`,
    'Update dependency selector handling for this slot kind.'
  );
}

function shotVideoInputAssetFromRequest(
  request: MediaGenerationDependencyRequest | undefined,
  slot: MediaGenerationDependencySlot
): MediaGenerationDependencySelectorResult {
  if (request?.kind !== 'media-generation-spec') {
    return invalidSelection(
      slot,
      'CORE_MEDIA_DEPENDENCY_SELECTOR_REQUEST_INVALID',
      `Shot video input dependency selector received an invalid request kind for ${slot.label}.`,
      'Resolve shot video input dependencies with a media-generation-spec request.'
    );
  }
  const spec = request.spec as ShotVideoTakeOutputGenerationSpec | undefined;
  if (spec?.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    return invalidSelection(
      slot,
      'CORE_MEDIA_DEPENDENCY_SELECTOR_REQUEST_INVALID',
      `Shot video input dependency selector received an invalid media generation spec for ${slot.label}.`,
      'Resolve shot video input dependencies with a shot video take output generation spec.'
    );
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
  input: ShotVideoTakeOutputGenerationSpec['inputs'][number],
  slot: MediaGenerationDependencySlot
): boolean {
  if (slot.selector.kind !== 'shot-video-input') {
    return false;
  }
  return (
    input.kind === slot.selector.inputKind &&
    (!slot.selector.subjectKind || input.subjectKind === slot.selector.subjectKind) &&
    (!slot.selector.subjectId || input.subjectId === slot.selector.subjectId)
  );
}

function selectedAssetForTarget(
  session: DatabaseSession,
  input: {
    target: Parameters<typeof listAssetRelationshipPage>[1]['target'];
    assetId?: string;
    role: string;
    mediaKind: string;
    slot: MediaGenerationDependencySlot;
    fileRole?: string;
    selectionPolicy: 'selected-only' | 'selected-or-default';
  }
): MediaGenerationDependencySelectorResult {
  if (input.assetId) {
    const asset = listAssetRelationshipPage(session, {
      target: input.target,
      role: input.role,
      mediaKind: input.mediaKind,
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items.find((candidate) => candidate.assetId === input.assetId);
    if (!asset) {
      return invalidSelection(
        input.slot,
        'CORE_MEDIA_DEPENDENCY_REFERENCED_ASSET_NOT_AVAILABLE',
        `Referenced asset is not available for ${input.slot.label}: ${input.assetId}.`,
        'Choose an asset attached to the target with the expected role and media kind.'
      );
    }
    const fileResult = dependencyFile(asset, input.mediaKind, input.fileRole);
    if (fileResult.state === 'invalid') {
      return invalidSelection(
        input.slot,
        fileResult.code,
        fileResult.message,
        fileResult.suggestion
      );
    }
    if (!fileResult.file) {
      return invalidSelection(
        input.slot,
        'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
        `Referenced asset has no required ${input.mediaKind} file for ${input.slot.label}: ${asset.assetId}.`,
        'Import or regenerate the referenced asset before using it as a dependency.'
      );
    }
    return withAsset({
      assetId: asset.assetId,
      assetFileId: fileResult.file.id,
      projectRelativePath: fileResult.file.projectRelativePath,
    });
  }
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
  const asset =
    selectedAssets[0] ??
    (input.selectionPolicy === 'selected-or-default'
      ? listAssetRelationshipPage(session, {
          target: input.target,
          role: input.role,
          mediaKind: input.mediaKind,
          limit: MAX_RESOURCE_PAGE_LIMIT,
        }).items[0]
      : undefined);
  if (!asset) {
    return noAsset();
  }
  const fileResult = dependencyFile(asset, input.mediaKind, input.fileRole);
  if (fileResult.state === 'invalid') {
    return invalidSelection(
      input.slot,
      fileResult.code,
      fileResult.message,
      fileResult.suggestion
    );
  }
  if (!fileResult.file) {
    return invalidSelection(
      input.slot,
      'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
      `Selected asset has no required ${input.mediaKind} file for ${input.slot.label}: ${asset.assetId}.`,
      'Import or regenerate the selected asset before using it as a dependency.'
    );
  }
  return withAsset({
    assetId: asset.assetId,
    assetFileId: fileResult.file.id,
    projectRelativePath: fileResult.file.projectRelativePath,
  });
}

function selectLookbookSheet(input: {
  sheets: ReturnType<typeof listLookbookSheets>;
  lookbookSheetId?: string;
  selectionPolicy: 'selected-only' | 'selected-or-default';
}): ReturnType<typeof listLookbookSheets>[number] | 'invalid-selected-sheet' | undefined {
  if (input.lookbookSheetId) {
    return (
      input.sheets.find((sheet) => sheet.id === input.lookbookSheetId) ??
      'invalid-selected-sheet'
    );
  }
  if (input.selectionPolicy === 'selected-only') {
    return undefined;
  }
  return input.sheets[0];
}

function dependencyFile(
  asset: Asset,
  mediaKind: string,
  fileRole?: string
):
  | { state: 'valid'; file: Asset['files'][number] | undefined }
  | {
      state: 'invalid';
      code: string;
      message: string;
      suggestion: string;
    } {
  return {
    state: 'valid',
    file: asset.files.find(
      (candidate) =>
        candidate.mediaKind === mediaKind &&
        (fileRole === undefined || candidate.role === fileRole)
    ),
  };
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
