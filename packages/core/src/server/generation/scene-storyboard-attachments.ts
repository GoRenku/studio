import path from 'node:path';
import type {
  Asset,
  ProjectRelativePath,
  SceneStoryboardImagesImportDocument,
  SceneStoryboardImagesImportReport,
} from '../../client/index.js';
import { readOwnedAsset } from '../assets/projection.js';
import { assetSelectionTargetForOwnerType } from '../assets/selection.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  readSceneBeatSheetDocument,
  requireSceneBeatSheetForScene,
} from '../database/access/scene-beat-sheets.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { createUniqueIdAllocator, type ProjectIdGenerator } from '../entity-ids.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  allocateSceneStoryboardIterationFolderSync,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioSceneBeatsResourceKey } from '../studio-coordination/resource-keys.js';
import { validateGenerationProvenance } from './attachments.js';
import { persistOwnedGeneratedMediaAssetInSession } from './attachment-persistence.js';

export function attachSceneStoryboardImages(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  beatSheetId: string;
  document: SceneStoryboardImagesImportDocument;
  idGenerator: ProjectIdGenerator;
}): SceneStoryboardImagesImportReport {
  validateDocumentIdentity(input);
  const screenplay = readScreenplayDocumentFromSession(input.session);
  if (!screenplay) {
    throw new ProjectDataError(
      'CORE_GENERATION_CONTEXT_UNAVAILABLE',
      'A screenplay is required to attach storyboard images.'
    );
  }
  const beatSheet = readSceneBeatSheetDocument({
    row: requireSceneBeatSheetForScene({
      session: input.session,
      sceneId: input.sceneId,
      beatSheetId: input.beatSheetId,
    }),
    screenplay,
  });
  const sources = new Set<string>();
  const beatIds = new Set<string>();
  const normalized = input.document.beats.map((file) => {
    if (beatIds.has(file.beatId) || sources.has(file.source)) {
      throw invalidDocument('Storyboard attachment cannot repeat a Beat or source file.');
    }
    const beat = beatSheet.beats.find((candidate) => candidate.id === file.beatId);
    if (!beat) {
      throw invalidDocument(`Storyboard attachment references a missing Beat: ${file.beatId}.`);
    }
    const source = normalizeProjectRelativePath(file.source);
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(source).toLocaleLowerCase())) {
      throw invalidDocument(`Storyboard attachment source must be an image: ${source}.`);
    }
    beatIds.add(file.beatId);
    sources.add(source);
    const provenance = validateGenerationProvenance({
      session: input.session,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: input.sceneId },
      sourceProjectRelativePath: source,
      destinationAssetType: 'scene_storyboard_image',
      ...(file.sourceSpecId ? { sourceSpecId: file.sourceSpecId } : {}),
      ...(file.sourceRunId ? { receipt: { id: file.sourceRunId } } : {}),
    });
    return {
      ...file,
      source,
      beat,
      beatOrdinal: beatSheet.beats.indexOf(beat) + 1,
      provenance,
    };
  });
  const ids = createUniqueIdAllocator(input.idGenerator);
  const now = new Date().toISOString();
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  const iterationFolder = allocateSceneStoryboardIterationFolderSync({
    session: input.session,
    projectFolder: input.projectFolder,
    sceneId: input.sceneId,
  });
  const importedIds: Array<{ beatId: string; assetId: string }> = [];
  const files: SceneStoryboardImagesImportReport['files'] = [];
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      const pending = normalized.map((file) => {
        const assetId = ids('asset');
        const assetFileId = ids('asset_file');
        const title = file.title?.trim() || file.beat.title || 'Storyboard image';
        const owner = {
          kind: 'sceneBeat' as const,
          sceneId: input.sceneId,
          beatId: file.beatId,
        };
        return {
          ...file,
          title,
          owner,
          assetId,
          assetFileId,
          selectionTarget: input.document.select
            ? assetSelectionTargetForOwnerType(owner, 'scene_storyboard_image')
            : null,
        };
      });
      for (const file of pending) {
        const assetFile = persistOwnedGeneratedMediaAssetInSession({
          session,
          projectFolder: input.projectFolder,
          writeSet,
          assetId: file.assetId,
          assetFileId: file.assetFileId,
          now,
          sourceProjectRelativePath: file.source,
          destination: {
            kind: 'scene.storyboardImage',
            sceneId: input.sceneId,
            iterationFolder,
            beatOrdinal: file.beatOrdinal,
          },
          owner: file.owner,
          ...(file.selectionTarget ? { selectionTarget: file.selectionTarget } : {}),
          asset: {
            type: 'scene_storyboard_image',
            mediaKind: 'image',
            title: file.title,
            origin: file.sourceSpecId || file.sourceRunId ? 'generated' : 'external',
          },
          fileRole: 'storyboard_image',
          ...(file.provenance?.kind === 'agent-external'
            ? { sourceSpecId: file.provenance.generationSpecId }
            : {}),
          ...(file.provenance?.kind === 'renku-managed'
            ? {
                selectedGenerationOutput: {
                  generationRunId: file.provenance.generationRunId,
                  outputArtifactId: file.provenance.outputArtifactId,
                },
              }
            : {}),
        });
        importedIds.push({ beatId: file.beatId, assetId: file.assetId });
        files.push({
          role: 'storyboard_image',
          beatId: file.beatId,
          projectRelativePath: assetFile.projectRelativePath as ProjectRelativePath,
        });
      }
    });
    commitProjectAssetFileWriteSet(writeSet);
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  const imported: Asset[] = importedIds.map(({ beatId, assetId }) => {
    const asset = readOwnedAsset(input.session, {
      owner: { kind: 'sceneBeat', sceneId: input.sceneId, beatId },
      assetId,
    });
    if (!asset) {
      throw new ProjectDataError(
        'CORE_GENERATION_STORYBOARD_ATTACHMENT_FAILED',
        `Storyboard Asset could not be projected: ${assetId}.`
      );
    }
    return asset;
  });
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'CORE_GENERATION_CONTEXT_UNAVAILABLE',
      'Project metadata is required to attach storyboard images.'
    );
  }
  return {
    valid: true,
    warnings: [],
    project: {
      id: project.id,
      name: project.name,
      projectFolder: input.projectFolder,
    },
    changes: [{
      type: 'scene.storyboardImagesImported',
      sceneId: input.sceneId,
      beatSheetId: input.beatSheetId,
    }],
    purpose: 'scene.storyboard-sheet',
    target: { kind: 'scene', id: input.sceneId },
    beatSheetId: input.beatSheetId,
    imported,
    files,
    resourceKeys: [studioSceneBeatsResourceKey(input.sceneId)],
  };
}

function validateDocumentIdentity(input: {
  document: SceneStoryboardImagesImportDocument;
  beatSheetId: string;
}): void {
  if (
    input.document.kind !== 'sceneStoryboardImagesImport'
    || input.document.beatSheetId !== input.beatSheetId
    || typeof input.document.select !== 'boolean'
  ) {
    throw invalidDocument(
      'Storyboard attachment document, explicit selection intent, and Beat Sheet must match.'
    );
  }
  if (input.document.beats.length === 0) {
    throw invalidDocument('Storyboard attachment requires at least one cropped Beat image.');
  }
}

function invalidDocument(message: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_GENERATION_STORYBOARD_ATTACHMENT_INVALID',
    message
  );
}
