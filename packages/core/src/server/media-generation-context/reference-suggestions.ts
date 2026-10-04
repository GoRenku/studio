import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationAssetFile,
  MediaGenerationLookbookContext,
  MediaGenerationReferenceCandidate,
  MediaGenerationReferenceRole,
  MediaGenerationReferenceSuggestion,
  MediaGenerationSceneContext,
} from '../../client/media-generation-context.js';
import type { GenerationAssetFiles } from './reference-assets.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import type { DialogueTurnRange } from '../../client/shot-plan-dialogue-audio.js';
import { listAssetFilesInSession } from '../asset-files/projection.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { statProjectFileSync } from '../project-asset-files/file-operations.js';

export function suggestLookbookMedia(input: {
  lookbooks: MediaGenerationLookbookContext[];
  role: MediaGenerationReferenceRole;
  projectFolder: string;
  warnings: DiagnosticIssue[];
  collection: GenerationAssetFiles;
}): MediaGenerationReferenceSuggestion[] {
  return input.lookbooks.map((lookbook) => createReferenceSuggestion({
    id: `${lookbook.kind}-lookbook`,
    role: input.role,
    assetFiles: [
      ...lookbook.images.map((image) => input.collection.get(image.assetFileId)),
      ...lookbook.sheets.map((sheet) => input.collection.get(sheet.assetFileId)),
    ],
    selectedAssetFileIds: lookbook.selectedImageId ? [lookbook.selectedImageId] : [],
    projectFolder: input.projectFolder,
    warnings: input.warnings,
    collection: input.collection,
  }));
}

export function suggestSceneSubjectMedia(input: {
  sceneContext: MediaGenerationSceneContext;
  projectFolder: string;
  warnings: DiagnosticIssue[];
  collection: GenerationAssetFiles;
}): MediaGenerationReferenceSuggestion[] {
  return [
    ...input.sceneContext.castMembers.map((context) => createReferenceSuggestion({
      id: 'cast-continuity',
      role: 'continuity',
      subject: { kind: 'castMember', id: context.castMember.id },
      assetFiles: context.assetFileIds.map((id) => input.collection.get(id)).filter((assetFile) => assetFile.type === 'character_sheet'),
      projectFolder: input.projectFolder,
      warnings: input.warnings,
      collection: input.collection,
    })),
    ...input.sceneContext.locations.map((context) => createReferenceSuggestion({
      id: 'location-continuity',
      role: 'continuity',
      subject: { kind: 'location', id: context.location.id },
      assetFiles: context.assetFileIds.map((id) => input.collection.get(id)).filter((assetFile) => assetFile.type === 'location_sheet'),
      projectFolder: input.projectFolder,
      warnings: input.warnings,
      collection: input.collection,
    })),
    ...input.sceneContext.props.map((context) => createReferenceSuggestion({
      id: 'prop-continuity',
      role: 'continuity',
      subject: { kind: 'prop', id: context.prop.id },
      assetFiles: context.assetFileIds.map((id) => input.collection.get(id)).filter((assetFile) => assetFile.type === 'prop_sheet'),
      projectFolder: input.projectFolder,
      warnings: input.warnings,
      collection: input.collection,
    })),
  ];
}

export function suggestBeatStoryboards(input: {
  session: DatabaseSession;
  sceneId: string;
  beatIds: string[];
  projectFolder: string;
  warnings: DiagnosticIssue[];
  collection: GenerationAssetFiles;
}): MediaGenerationReferenceSuggestion[] {
  return input.beatIds.map((beatId) => {
    const assetFiles = listAssetFilesInSession(input.session, {
      owner: { kind: 'sceneBeat', sceneId: input.sceneId, beatId },
      type: 'scene_storyboard_image',
    });
    return createReferenceSuggestion({
      id: 'beat-storyboard',
      role: 'beat-storyboard',
      subject: { kind: 'sceneBeat', id: beatId },
      assetFiles,
      projectFolder: input.projectFolder,
      warnings: input.warnings,
      collection: input.collection,
    });
  });
}

export function suggestSelectedShotImages(input: {
  shots: Array<{ id: string; images: MediaGenerationAssetFile[]; selectedImageId: string | null }>;
  projectFolder: string;
  warnings: DiagnosticIssue[];
  collection: GenerationAssetFiles;
}): MediaGenerationReferenceSuggestion[] {
  return input.shots.map((shot) => createReferenceSuggestion({
    id: 'shot-image',
    role: 'shot-image',
    subject: { kind: 'shot', id: shot.id },
    assetFiles: shot.images.filter((assetFile) => assetFile.id === shot.selectedImageId),
    selectedAssetFileIds: shot.selectedImageId ? [shot.selectedImageId] : [],
    projectFolder: input.projectFolder,
    warnings: input.warnings,
    collection: input.collection,
  }));
}

export function suggestShotPlanMedia(input: {
  session: DatabaseSession;
  shotPlanId: string;
  roles: Array<{ assetFileType: string; role: MediaGenerationReferenceRole }>;
  projectFolder: string;
  warnings: DiagnosticIssue[];
  collection: GenerationAssetFiles;
}): MediaGenerationReferenceSuggestion[] {
  const assetFiles = listAssetFilesInSession(input.session, { owner: { kind: 'project' } })
    .filter((assetFile) => assetFile.authoredFrom?.id === input.shotPlanId);
  return input.roles.map(({ assetFileType, role }) => createReferenceSuggestion({
    id: role,
    role,
    assetFiles: assetFiles.filter((assetFile) => assetFile.type === assetFileType),
    projectFolder: input.projectFolder,
    warnings: input.warnings,
    collection: input.collection,
  }));
}

export function createReferenceSuggestion(input: {
  id: string;
  role: MediaGenerationReferenceRole;
  subject?: { kind: string; id: string };
  assetFiles: MediaGenerationAssetFile[];
  fileIds?: string[];
  selectedAssetFileIds?: string[];
  workflowSelectedAssetFileIds?: string[];
  dialogueTurnRangesByAssetFileId?: Map<string, DialogueTurnRange>;
  projectFolder: string;
  warnings: DiagnosticIssue[];
  collection: GenerationAssetFiles;
}): MediaGenerationReferenceSuggestion {
  input.assetFiles.forEach((assetFile) => input.collection.add(assetFile));
  const selectedAssetFileIds = new Set(input.selectedAssetFileIds ?? []);
  const workflowSelectedAssetFileIds = new Set(
    input.workflowSelectedAssetFileIds ?? [],
  );
  const candidates = [...input.assetFiles]
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id)
    )
    .flatMap((assetFile) => {
        const file = assetFile;
        if (input.fileIds && !input.fileIds.includes(file.id)) { return []; }
        if (!isMediaKind(file.mediaKind)) {
          input.warnings.push(unavailableFileWarning(file.id, 'has unsupported media metadata'));
          return [];
        }
        const available = isAvailableProjectFile(input.projectFolder, file.projectRelativePath);
        if (!available) {
          input.warnings.push(unavailableFileWarning(file.id, 'is not available in the Project folder'));
        }
        return [{
          assetFileId: file.id,
          ...(input.dialogueTurnRangesByAssetFileId?.get(assetFile.id)
            ? { dialogueTurnRange: input.dialogueTurnRangesByAssetFileId.get(assetFile.id)! }
            : {}),
          isDisplaySelected: selectedAssetFileIds.has(assetFile.id),
          isWorkflowSelected: workflowSelectedAssetFileIds.has(assetFile.id),
          available,
        } satisfies MediaGenerationReferenceCandidate];
      });
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
  projectRelativePath: ProjectRelativePath,
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
