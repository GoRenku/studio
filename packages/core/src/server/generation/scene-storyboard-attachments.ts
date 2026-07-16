import path from 'node:path';
import type { Asset, ProjectRelativePath, SceneStoryboardImagesImportDocument, SceneStoryboardImagesImportReport } from '../../client/index.js';
import { insertAssetRelationshipRecord, nextAssetRelationshipSortOrder } from '../database/access/asset-relationships/index.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { readProjectRecord } from '../database/access/project.js';
import { readSceneBeatSheetDocument, requireSceneBeatSheetForScene } from '../database/access/scene-beat-sheets.js';
import { beatContentFingerprint, insertSceneBeatStoryboardImageRecord } from '../database/access/scene-beat-storyboard-images.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { createUniqueIdAllocator, type ProjectIdGenerator } from '../entity-ids.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import { commitProjectAssetFileWriteSet, createProjectAssetFileWriteSet, persistSceneStoryboardBeatFilesSync, rollbackProjectAssetFileWriteSetSync } from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneBeatSheetResourceKeys } from '../scene-beat-sheet/storyboard-status.js';

export function attachSceneStoryboardImages(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  beatSheetId: string;
  document: SceneStoryboardImagesImportDocument;
  idGenerator: ProjectIdGenerator;
}): SceneStoryboardImagesImportReport {
  if (input.document.kind !== 'sceneStoryboardImagesImport' || input.document.beatSheetId !== input.beatSheetId) {
    throw new ProjectDataError('CORE_GENERATION_STORYBOARD_ATTACHMENT_INVALID', 'Storyboard attachment document and Beat Sheet must match.');
  }
  if (input.document.beats.length === 0) {
    throw new ProjectDataError('CORE_GENERATION_STORYBOARD_ATTACHMENT_INVALID', 'Storyboard attachment requires at least one cropped Beat image.');
  }
  const screenplay = readScreenplayDocumentFromSession(input.session);
  if (!screenplay) {
    throw new ProjectDataError('CORE_GENERATION_CONTEXT_UNAVAILABLE', 'A screenplay is required to attach storyboard images.');
  }
  const beatSheet = readSceneBeatSheetDocument({ row: requireSceneBeatSheetForScene({ session: input.session, sceneId: input.sceneId, beatSheetId: input.beatSheetId }), screenplay });
  const sources = new Set<string>();
  const beatIds = new Set<string>();
  const normalized = input.document.beats.map((file) => {
    if (beatIds.has(file.beatId) || sources.has(file.source)) {
      throw new ProjectDataError('CORE_GENERATION_STORYBOARD_ATTACHMENT_INVALID', 'Storyboard attachment cannot repeat a Beat or source file.');
    }
    const beat = beatSheet.beats.find((candidate) => candidate.id === file.beatId);
    if (!beat) {
      throw new ProjectDataError('CORE_GENERATION_STORYBOARD_ATTACHMENT_INVALID', `Storyboard attachment references a missing Beat: ${file.beatId}.`);
    }
    const source = normalizeProjectRelativePath(file.source);
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(source).toLocaleLowerCase())) {
      throw new ProjectDataError('CORE_GENERATION_STORYBOARD_ATTACHMENT_INVALID', `Storyboard attachment source must be an image: ${source}.`);
    }
    beatIds.add(file.beatId);
    sources.add(source);
    return { ...file, source, beat, beatOrdinal: beatSheet.beats.indexOf(beat) + 1 };
  });
  const ids = createUniqueIdAllocator(input.idGenerator);
  const now = new Date().toISOString();
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  const assets: Asset[] = [];
  const storyboardImageIds: string[] = [];
  const files: SceneStoryboardImagesImportReport['files'] = [];
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      const pending = normalized.map((file) => {
        const assetId = ids('asset');
        const assetFileId = ids('asset_file');
        const title = file.title?.trim() || file.beat.title || 'Storyboard image';
        insertAssetRecord(session, { id: assetId, type: 'scene_storyboard_image', mediaKind: 'image', title, origin: 'external', availability: 'ready', createdAt: now, updatedAt: now });
        return { ...file, title, assetId, assetFileId, relationshipId: ids('scene_asset'), storyboardImageId: ids('scene_beat_storyboard_image') };
      });
      const persisted = persistSceneStoryboardBeatFilesSync({ session, projectFolder: input.projectFolder, writeSet, sceneId: input.sceneId, files: pending.map((file) => ({ assetId: file.assetId, assetFileId: file.assetFileId, beatId: file.beatId, beatOrdinal: file.beatOrdinal, sourceProjectRelativePath: file.source })), now });
      const persistedByBeatId = new Map(persisted.map((file) => [file.beatId, file.assetFile]));
      for (const file of pending) {
        const assetFile = persistedByBeatId.get(file.beatId);
        if (!assetFile) {
          throw new ProjectDataError('CORE_GENERATION_STORYBOARD_ATTACHMENT_FAILED', `Storyboard image was not persisted for Beat ${file.beatId}.`);
        }
        const target = { kind: 'scene' as const, sceneId: input.sceneId };
        const sortOrder = nextAssetRelationshipSortOrder(session, { target, role: 'storyboard_image', localeId: null });
        insertAssetRelationshipRecord(session, target, { relationshipId: file.relationshipId, assetId: file.assetId, localeId: null, role: 'storyboard_image', sortOrder, now });
        insertSceneBeatStoryboardImageRecord(session, { id: file.storyboardImageId, sceneId: input.sceneId, beatSheetId: input.beatSheetId, beatId: file.beatId, assetId: file.assetId, assetFileId: file.assetFileId, sourcePurpose: 'scene.storyboard-sheet', beatContentFingerprint: beatContentFingerprint(file.beat), now });
        storyboardImageIds.push(file.storyboardImageId);
        files.push({ role: 'storyboard_image', beatId: file.beatId, projectRelativePath: assetFile.projectRelativePath as ProjectRelativePath });
        assets.push({ assetId: file.assetId, relationshipId: file.relationshipId, target, localeId: null, type: 'scene_storyboard_image', availability: 'ready', mediaKind: 'image', title: file.title, oneLineSummary: null, origin: 'external', role: 'storyboard_image', referenceName: null, purpose: null, sortOrder, files: [{ id: file.assetFileId, role: 'storyboard_image', projectRelativePath: assetFile.projectRelativePath as ProjectRelativePath, mediaKind: 'image', mimeType: assetFile.mimeType, sizeBytes: assetFile.sizeBytes, contentHash: assetFile.contentHash, width: null, height: null, durationSeconds: null }], createdAt: now, updatedAt: now });
      }
    });
    commitProjectAssetFileWriteSet(writeSet);
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError('CORE_GENERATION_CONTEXT_UNAVAILABLE', 'Project metadata is required to attach storyboard images.');
  }
  return { valid: true, warnings: [], project: { id: project.id, name: project.name, projectFolder: input.projectFolder }, changes: [{ type: 'scene.storyboardImagesImported', sceneId: input.sceneId, beatSheetId: input.beatSheetId }], purpose: 'scene.storyboard-sheet', target: { kind: 'scene', id: input.sceneId }, beatSheetId: input.beatSheetId, storyboardImageIds, imported: assets, files, resourceKeys: sceneBeatSheetResourceKeys({ sceneId: input.sceneId, beatSheetId: input.beatSheetId, beatIds: normalized.map((file) => file.beatId) }) };
}
