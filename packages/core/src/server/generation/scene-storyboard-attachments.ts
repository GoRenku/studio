import path from 'node:path';
import type {
  AssetFile,
  ProjectRelativePath,
  SceneStoryboardImagesImportDocument,
  SceneStoryboardImagesImportReport,
} from '../../client/index.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { assetFileSelectionTargetForOwnerType } from '../asset-files/selection.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  readSceneBeats,
  requireSceneBeatsRevisionForScene,
} from '../database/access/scene-beats.js';
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
import { validateMediaGenerationProvenance } from '../asset-files/generation-provenance.js';
import { persistOwnedGeneratedMediaAssetFileInSession } from './attachment-persistence.js';

export function attachSceneStoryboardImages(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  sceneBeatsRevisionId: string;
  document: SceneStoryboardImagesImportDocument;
  idGenerator: ProjectIdGenerator;
}): SceneStoryboardImagesImportReport {
  validateDocumentIdentity(input);
  const revision = readSceneBeats({
    row: requireSceneBeatsRevisionForScene({
      session: input.session,
      sceneId: input.sceneId,
      revisionId: input.sceneBeatsRevisionId,
    }),
  });
  const sources = new Set<string>();
  const beatIds = new Set<string>();
  const normalized = input.document.beats.map((file) => {
    if (beatIds.has(file.beatId) || sources.has(file.source)) {
      throw invalidDocument('Storyboard attachment cannot repeat a Beat or source file.');
    }
    const beat = revision.beats.find((candidate) => candidate.id === file.beatId);
    if (!beat) {
      throw invalidDocument(`Storyboard attachment references a missing Beat: ${file.beatId}.`);
    }
    const source = normalizeProjectRelativePath(file.source);
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(source).toLocaleLowerCase())) {
      throw invalidDocument(`Storyboard attachment source must be an image: ${source}.`);
    }
    beatIds.add(file.beatId);
    sources.add(source);
    const generationProvenance = file.generationProvenance
      ? validateMediaGenerationProvenance(file.generationProvenance)
      : null;
    if (generationProvenance && generationProvenance.mediaKind !== 'image') {
      throw invalidDocument('Storyboard generation provenance must describe image media.');
    }
    return {
      ...file,
      source,
      beat,
      beatNumber: beat.number,
      generationProvenance,
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
  const importedIds: Array<{ beatId: string; assetFileId: string }> = [];
  const files: SceneStoryboardImagesImportReport['files'] = [];
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      const pending = normalized.map((file) => {
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
          assetFileId,
          selectionTarget: input.document.select
            ? assetFileSelectionTargetForOwnerType(owner, 'scene_storyboard_image')
            : null,
        };
      });
      for (const file of pending) {
        const assetFile = persistOwnedGeneratedMediaAssetFileInSession({
          session,
          projectFolder: input.projectFolder,
          writeSet,
          assetFileId: file.assetFileId,
          now,
          sourceProjectRelativePath: file.source,
          destination: {
            kind: 'scene.storyboardImage',
            sceneId: input.sceneId,
            iterationFolder,
            beatNumber: file.beatNumber,
          },
          owner: file.owner,
          ...(file.selectionTarget ? { selectionTarget: file.selectionTarget } : {}),
          assetFileMetadata: {
            type: 'scene_storyboard_image',
            mediaKind: 'image',
            title: file.title,
            origin: file.generationProvenance ? 'generated' : 'external',
          },
          ...(file.generationProvenance
            ? { generationProvenance: file.generationProvenance }
            : {}),
        });
        importedIds.push({ beatId: file.beatId, assetFileId: file.assetFileId });
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
  const imported: AssetFile[] = importedIds.map(({ beatId, assetFileId }) => {
    const assetFile = readOwnedAssetFile(input.session, {
      owner: { kind: 'sceneBeat', sceneId: input.sceneId, beatId },
      assetFileId,
    });
    if (!assetFile) {
      throw new ProjectDataError(
        'CORE_GENERATION_STORYBOARD_ATTACHMENT_FAILED',
        `Storyboard Asset could not be projected: ${assetFileId}.`
      );
    }
    return assetFile;
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
      projectName: project.projectName,
      projectFolder: input.projectFolder,
    },
    changes: [{
      type: 'scene.storyboardImagesImported',
      sceneId: input.sceneId,
      sceneBeatsRevisionId: input.sceneBeatsRevisionId,
    }],
    purpose: 'scene.storyboard-sheet',
    target: { kind: 'scene', id: input.sceneId },
    sceneBeatsRevisionId: input.sceneBeatsRevisionId,
    imported,
    files,
    resourceKeys: [studioSceneBeatsResourceKey(input.sceneId)],
  };
}

function validateDocumentIdentity(input: {
  document: SceneStoryboardImagesImportDocument;
  sceneBeatsRevisionId: string;
}): void {
  if (
    input.document.sceneBeatsRevisionId !== input.sceneBeatsRevisionId
    || typeof input.document.select !== 'boolean'
  ) {
    throw invalidDocument(
      'Storyboard attachment document, explicit selection intent, and Scene Beats revision must match.'
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
