import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from '../../client/assets.js';
import type {
  MediaGenerationLookbookContext,
  MediaGenerationReferenceCandidate,
  MediaGenerationReferenceRole,
  MediaGenerationReferenceSuggestion,
  MediaGenerationSceneContext,
} from '../../client/media-generation-context.js';
import type { DialogueTurnRange } from '../../client/shot-plan-dialogue-audio.js';
import { listAssetsInSession } from '../assets/projection.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { statProjectFileSync } from '../project-asset-files/file-operations.js';

export function suggestLookbookMedia(input: {
  lookbooks: MediaGenerationLookbookContext[];
  role: MediaGenerationReferenceRole;
  projectFolder: string;
  warnings: DiagnosticIssue[];
}): MediaGenerationReferenceSuggestion[] {
  return input.lookbooks.map((lookbook) => createReferenceSuggestion({
    id: `${lookbook.kind}-lookbook`,
    role: input.role,
    assets: [
      ...lookbook.images.map((image) => image.asset),
      ...lookbook.sheets.map((sheet) => sheet.asset),
    ],
    selectedAssetIds: lookbook.selectedImageId ? [lookbook.selectedImageId] : [],
    projectFolder: input.projectFolder,
    warnings: input.warnings,
  }));
}

export function suggestSceneSubjectMedia(input: {
  sceneContext: MediaGenerationSceneContext;
  projectFolder: string;
  warnings: DiagnosticIssue[];
}): MediaGenerationReferenceSuggestion[] {
  return [
    ...input.sceneContext.castMembers.map((context) => createReferenceSuggestion({
      id: 'cast-continuity',
      role: 'continuity',
      subject: { kind: 'castMember', id: context.castMember.id },
      assets: context.assets.filter((asset) => asset.type === 'character_sheet'),
      projectFolder: input.projectFolder,
      warnings: input.warnings,
    })),
    ...input.sceneContext.locations.map((context) => createReferenceSuggestion({
      id: 'location-continuity',
      role: 'continuity',
      subject: { kind: 'location', id: context.location.id },
      assets: context.assets.filter((asset) => asset.type === 'location_sheet'),
      projectFolder: input.projectFolder,
      warnings: input.warnings,
    })),
    ...input.sceneContext.props.map((context) => createReferenceSuggestion({
      id: 'prop-continuity',
      role: 'continuity',
      subject: { kind: 'prop', id: context.prop.id },
      assets: context.assets.filter((asset) => asset.type === 'prop_sheet'),
      projectFolder: input.projectFolder,
      warnings: input.warnings,
    })),
  ];
}

export function suggestBeatStoryboards(input: {
  session: DatabaseSession;
  sceneId: string;
  beatIds: string[];
  projectFolder: string;
  warnings: DiagnosticIssue[];
}): MediaGenerationReferenceSuggestion[] {
  return input.beatIds.map((beatId) => {
    const assets = listAssetsInSession(input.session, {
      owner: { kind: 'sceneBeat', sceneId: input.sceneId, beatId },
      type: 'scene_storyboard_image',
    });
    return createReferenceSuggestion({
      id: 'beat-storyboard',
      role: 'beat-storyboard',
      subject: { kind: 'sceneBeat', id: beatId },
      assets,
      projectFolder: input.projectFolder,
      warnings: input.warnings,
    });
  });
}

export function suggestSelectedShotImages(input: {
  shots: Array<{ id: string; images: Asset[]; selectedImageId: string | null }>;
  projectFolder: string;
  warnings: DiagnosticIssue[];
}): MediaGenerationReferenceSuggestion[] {
  return input.shots.map((shot) => createReferenceSuggestion({
    id: 'shot-image',
    role: 'shot-image',
    subject: { kind: 'shot', id: shot.id },
    assets: shot.images.filter((asset) => asset.id === shot.selectedImageId),
    selectedAssetIds: shot.selectedImageId ? [shot.selectedImageId] : [],
    projectFolder: input.projectFolder,
    warnings: input.warnings,
  }));
}

export function suggestShotPlanMedia(input: {
  session: DatabaseSession;
  shotPlanId: string;
  roles: Array<{ assetType: string; role: MediaGenerationReferenceRole }>;
  projectFolder: string;
  warnings: DiagnosticIssue[];
}): MediaGenerationReferenceSuggestion[] {
  const assets = listAssetsInSession(input.session, { owner: { kind: 'project' } })
    .filter((asset) => asset.authoredFrom?.id === input.shotPlanId);
  return input.roles.map(({ assetType, role }) => createReferenceSuggestion({
    id: role,
    role,
    assets: assets.filter((asset) => asset.type === assetType),
    projectFolder: input.projectFolder,
    warnings: input.warnings,
  }));
}

export function createReferenceSuggestion(input: {
  id: string;
  role: MediaGenerationReferenceRole;
  subject?: { kind: string; id: string };
  assets: Asset[];
  selectedAssetIds?: string[];
  workflowSelectedAssetIds?: string[];
  dialogueTurnRangesByAssetId?: Map<string, DialogueTurnRange>;
  projectFolder: string;
  warnings: DiagnosticIssue[];
}): MediaGenerationReferenceSuggestion {
  const selectedAssetIds = new Set(input.selectedAssetIds ?? []);
  const workflowSelectedAssetIds = new Set(
    input.workflowSelectedAssetIds ?? [],
  );
  const candidates = [...input.assets]
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id)
    )
    .flatMap((asset) => [...asset.files]
      .sort((left, right) => left.role.localeCompare(right.role) || left.id.localeCompare(right.id))
      .flatMap((file) => {
        if (!isMediaKind(file.mediaKind)) {
          input.warnings.push(unavailableFileWarning(file.id, 'has unsupported media metadata'));
          return [];
        }
        const available = isAvailableProjectFile(input.projectFolder, file.projectRelativePath);
        if (!available) {
          input.warnings.push(unavailableFileWarning(file.id, 'is not available in the Project folder'));
        }
        return [{
          assetId: asset.id,
          assetFileId: file.id,
          projectRelativePath: file.projectRelativePath,
          owner: asset.owner,
          assetType: asset.type,
          fileRole: file.role,
          mediaKind: file.mediaKind,
          mimeType: file.mimeType,
          title: asset.title,
          oneLineSummary: asset.oneLineSummary,
          referenceName: asset.referenceName,
          tags: asset.tags,
          generationProvenance: asset.generationProvenance,
          authoredFrom: asset.authoredFrom,
          ...(input.dialogueTurnRangesByAssetId?.get(asset.id)
            ? { dialogueTurnRange: input.dialogueTurnRangesByAssetId.get(asset.id)! }
            : {}),
          isDisplaySelected: selectedAssetIds.has(asset.id),
          isWorkflowSelected: workflowSelectedAssetIds.has(asset.id),
          available,
        } satisfies MediaGenerationReferenceCandidate];
      }));
  return {
    id: input.id,
    role: input.role,
    ...(input.subject ? { subject: input.subject } : {}),
    candidates,
  };
}

function unavailableFileWarning(assetFileId: string, reason: string): DiagnosticIssue {
  return createDiagnosticWarning(
    'CORE_MEDIA_GENERATION_CONTEXT_REFERENCE_FILE_UNAVAILABLE',
    `Suggested AssetFile ${assetFileId} ${reason}.`,
    { path: ['suggestedReferences', assetFileId] },
    'Use another available reference or repair the registered Project file.',
  );
}

function isMediaKind(value: string): value is 'image' | 'video' | 'audio' {
  return value === 'image' || value === 'video' || value === 'audio';
}

function isAvailableProjectFile(
  projectFolder: string,
  projectRelativePath: MediaGenerationReferenceCandidate['projectRelativePath'],
): boolean {
  try {
    statProjectFileSync(resolveProjectRelativePath(projectFolder, projectRelativePath), {
      code: 'CORE_MEDIA_GENERATION_CONTEXT_REFERENCE_FILE_UNAVAILABLE',
      message: 'Suggested AssetFile is unavailable.',
    });
    return true;
  } catch {
    return false;
  }
}
