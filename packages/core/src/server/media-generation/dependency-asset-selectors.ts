import type {
  Asset,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencySlot,
  ShotVideoTakeGenerationSpec,
} from '../../client/index.js';
import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../client/index.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  MediaGenerationDependencyAssetResolution,
  ResolvedMediaGenerationDependencyAsset,
} from './dependency-graph.js';
import { listLookbookSheets } from '../database/access/lookbook-sheets.js';
import { readLocationEnvironmentSheetByAssetId } from '../database/access/location-environment-sheets.js';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';

export function resolveExistingDependencyAsset(input: {
  request?: MediaGenerationDependencyRequest;
  session: DatabaseSession;
  slot: MediaGenerationDependencySlot;
}): MediaGenerationDependencyAssetResolution {
  const shotVideoInput = shotVideoInputAssetFromRequest(input.request, input.slot);
  if (shotVideoInput) {
    return shotVideoInput;
  }
  if (input.slot.dependencyKind === 'cast-character-sheet') {
    if (input.slot.dependencyTarget?.kind !== 'castMember') {
      return noAsset();
    }
    return selectedAssetForTarget(input.session, {
      target: {
        kind: 'castMember',
        castMemberId: input.slot.dependencyTarget.id,
      },
      role: 'character_sheet',
      slot: input.slot,
    });
  }
  if (input.slot.dependencyKind === 'location-environment-sheet') {
    if (input.slot.dependencyTarget?.kind !== 'location') {
      return noAsset();
    }
    return selectedAssetForTarget(input.session, {
      target: {
        kind: 'location',
        locationId: input.slot.dependencyTarget.id,
      },
      role: 'environment_sheet',
      slot: input.slot,
      fileRole: 'composite',
    });
  }
  if (input.slot.dependencyKind === 'lookbook-sheet') {
    if (input.slot.dependencyTarget?.kind !== 'lookbook') {
      return noAsset();
    }
    const sheet = listLookbookSheets(input.session, input.slot.dependencyTarget.id)[0];
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
        })
      : noAsset();
  }
  return noAsset();
}

function shotVideoInputAssetFromRequest(
  request: MediaGenerationDependencyRequest | undefined,
  slot: MediaGenerationDependencySlot
): MediaGenerationDependencyAssetResolution | null {
  if (
    slot.dependencyKind !== 'first-frame' &&
    slot.dependencyKind !== 'last-frame' &&
    slot.dependencyKind !== 'reference-image' &&
    slot.dependencyKind !== 'multi-shot-storyboard-sheet' &&
    slot.dependencyKind !== 'cast-character-sheet' &&
    slot.dependencyKind !== 'location-environment-sheet' &&
    slot.dependencyKind !== 'lookbook-sheet'
  ) {
    return null;
  }
  if (request?.kind !== 'media-generation-spec') {
    return null;
  }
  const spec = request.spec as ShotVideoTakeGenerationSpec | undefined;
  if (spec?.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    return null;
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
  });
}

function shotVideoInputMatchesDependencySlot(
  input: ShotVideoTakeGenerationSpec['inputs'][number],
  slot: MediaGenerationDependencySlot
): boolean {
  if (
    input.kind !== inputKindForDependencyKind(slot.dependencyKind) ||
    input.mediaKind !== 'image'
  ) {
    return false;
  }
  const target = slot.dependencyTarget;
  if (!target) {
    return true;
  }
  if (target.kind === 'castMember') {
    return input.subjectKind === 'cast-member' && input.subjectId === target.id;
  }
  if (target.kind === 'location') {
    return input.subjectKind === 'location' && input.subjectId === target.id;
  }
  if (target.kind === 'lookbook') {
    return input.subjectKind === 'lookbook' && input.subjectId === target.id;
  }
  if (target.kind !== 'sceneShotGroup') {
    return true;
  }
  if (!input.subjectKind) {
    return true;
  }
  if (input.subjectKind === 'production-group') {
    return (
      input.subjectId === target.productionGroupId ||
      input.subjectId === target.id
    );
  }
  if (input.subjectKind === 'shot') {
    return target.shotIds.includes(input.subjectId ?? '');
  }
  return false;
}

function inputKindForDependencyKind(
  dependencyKind: MediaGenerationDependencySlot['dependencyKind']
): ShotVideoTakeGenerationSpec['inputs'][number]['kind'] {
  if (dependencyKind === 'first-frame') {
    return 'first-frame';
  }
  if (dependencyKind === 'last-frame') {
    return 'last-frame';
  }
  if (dependencyKind === 'multi-shot-storyboard-sheet') {
    return 'multi-shot-storyboard-sheet';
  }
  if (dependencyKind === 'cast-character-sheet') {
    return 'character-sheet';
  }
  if (dependencyKind === 'location-environment-sheet') {
    return 'location-sheet';
  }
  if (dependencyKind === 'lookbook-sheet') {
    return 'lookbook-sheet';
  }
  return 'reference-image';
}

function selectedAssetForTarget(
  session: DatabaseSession,
  input: {
    target: Parameters<typeof listAssetRelationshipPage>[1]['target'];
    role: string;
    slot: MediaGenerationDependencySlot;
    fileRole?: string;
  }
): MediaGenerationDependencyAssetResolution {
  const selectedAssets = listAssetRelationshipPage(session, {
    target: input.target,
    role: input.role,
    mediaKind: 'image',
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
    mediaKind: 'image',
    limit: MAX_RESOURCE_PAGE_LIMIT,
  }).items[0];
  if (!asset) {
    return noAsset();
  }
  const file = dependencyImageFile(session, asset, input.fileRole);
  if (!file) {
    return invalidSelection(
      input.slot,
      'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
      `Selected asset has no required image file for ${input.slot.label}: ${asset.assetId}.`,
      'Import or regenerate the selected asset before using it as a dependency.'
    );
  }
  return withAsset({
    assetId: asset.assetId,
    assetFileId: file.id,
  });
}

function dependencyImageFile(
  session: DatabaseSession,
  asset: Asset,
  fileRole?: string
): Asset['files'][number] | undefined {
  if (fileRole === 'composite') {
    const sheet = readLocationEnvironmentSheetByAssetId(session, asset.assetId);
    const compositeFileId = sheet?.compositeFileId ?? null;
    return asset.files.find(
      (candidate) =>
        candidate.id === compositeFileId &&
        candidate.role === 'composite' &&
        candidate.mediaKind === 'image'
    );
  }
  return asset.files.find((candidate) => candidate.mediaKind === 'image');
}

function withAsset(
  asset: ResolvedMediaGenerationDependencyAsset
): MediaGenerationDependencyAssetResolution {
  return { asset, diagnostics: [] };
}

function noAsset(): MediaGenerationDependencyAssetResolution {
  return { asset: null, diagnostics: [] };
}

function invalidSelection(
  slot: MediaGenerationDependencySlot,
  code: string,
  message: string,
  suggestion: string
): MediaGenerationDependencyAssetResolution {
  return {
    asset: null,
    diagnostics: [
      createDiagnosticError(
        code,
        message,
        { path: ['dependencyMap', 'selectors', slot.dependencyId] },
        suggestion
      ),
    ],
  };
}
