import { and, asc, eq, isNull } from 'drizzle-orm';
import {
  assetFiles,
  assets,
  mediaGenerationRuns,
  projectLocales,
  projects,
  sceneDialogueAudio,
  sceneDialogueAudioTakes,
  scenes,
  sceneShotVideoTakes,
  sceneShotVideoTakeVideos,
  sequences,
} from '../../schema/index.js';
import type { GenerationSpec } from '../../../client/generation.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface ProductionExportMediaRow {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  localeId: null;
  role: 'shot-video' | 'dialogue-audio';
  title: string;
  sourceProjectRelativePath: string;
  mediaKind: 'video' | 'audio';
  sourceSizeBytes: number | null;
  sourceContentHash: string | null;
  sequencePosition: number;
  sequenceTitle: string;
  scenePosition: number;
  sceneTitle: string;
  takeId: string;
  takeTitle: string;
  dialogueId: string | null;
}

export function readProductionProjectInfo(session: DatabaseSession): { id: string } {
  const row = session.db.select({ id: projects.id }).from(projects).limit(1).get();
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA102', 'Project database has no project row.');
  }
  return row;
}

export function assertProductionExportLocaleExists(
  session: DatabaseSession,
  localeId: string
): void {
  const row = session.db.select({ id: projectLocales.id }).from(projectLocales)
    .where(eq(projectLocales.id, localeId)).get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA103',
      `Requested production export locale was not found: ${localeId}.`
    );
  }
}

export function readProductionLocaleTag(
  session: DatabaseSession,
  localeId: string
): string {
  const row = session.db.select({ localeTag: projectLocales.localeTag })
    .from(projectLocales).where(eq(projectLocales.id, localeId)).get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA103',
      `Requested production export locale was not found: ${localeId}.`
    );
  }
  return row.localeTag;
}

export function readProductionExportMediaRows(
  session: DatabaseSession
): ProductionExportMediaRow[] {
  const videoRows = session.db.select({
    assetId: assets.id,
    assetFileId: assetFiles.id,
    sourceProjectRelativePath: assetFiles.projectRelativePath,
    sourceSizeBytes: assetFiles.sizeBytes,
    sourceContentHash: assetFiles.contentHash,
    title: assets.title,
    sequencePosition: sequences.position,
    sequenceTitle: sequences.title,
    scenePosition: scenes.position,
    sceneTitle: scenes.title,
    takeId: sceneShotVideoTakes.id,
    takeTitle: sceneShotVideoTakes.title,
  }).from(sceneShotVideoTakes)
    .innerJoin(scenes, eq(scenes.id, sceneShotVideoTakes.sceneId))
    .innerJoin(sequences, eq(sequences.id, scenes.sequenceId))
    .innerJoin(sceneShotVideoTakeVideos, eq(sceneShotVideoTakeVideos.takeId, sceneShotVideoTakes.id))
    .innerJoin(assets, eq(assets.id, sceneShotVideoTakeVideos.assetId))
    .innerJoin(assetFiles, eq(assetFiles.id, sceneShotVideoTakeVideos.assetFileId))
    .where(and(
      eq(sceneShotVideoTakes.isPicked, true),
      isNull(sceneShotVideoTakes.discardedAt),
      isNull(sceneShotVideoTakeVideos.discardedAt),
      isNull(assets.discardedAt),
      isNull(assetFiles.discardedAt)
    ))
    .orderBy(asc(sequences.position), asc(scenes.position), asc(sceneShotVideoTakes.createdAt))
    .all();
  const rows: ProductionExportMediaRow[] = [];
  for (const video of videoRows) {
    rows.push({
      ...video,
      relationshipId: `shot-video:${video.takeId}`,
      localeId: null,
      role: 'shot-video',
      mediaKind: 'video',
      dialogueId: null,
    });
    rows.push(...readDialogueRows(session, video));
  }
  return rows;
}

export function assertPickedTakesHaveReadyVideos(
  session: DatabaseSession,
  mediaRows: ProductionExportMediaRow[]
): void {
  const pickedTakes = session.db
    .select({ id: sceneShotVideoTakes.id, title: sceneShotVideoTakes.title })
    .from(sceneShotVideoTakes)
    .where(and(
      eq(sceneShotVideoTakes.isPicked, true),
      isNull(sceneShotVideoTakes.discardedAt)
    ))
    .all();
  const exportedTakeIds = new Set(
    mediaRows
      .filter((row) => row.role === 'shot-video')
      .map((row) => row.takeId)
  );
  const missing = pickedTakes.filter((take) => !exportedTakeIds.has(take.id));
  if (missing.length === 0) {
    return;
  }
  throw new ProjectDataError(
    'CORE_PRODUCTION_EXPORT_TAKE_VIDEO_MISSING',
    `Production export requires a current ready video for every picked Take. Missing: ${missing.map((take) => `${take.title} (${take.id})`).join(', ')}.`
  );
}

function readDialogueRows(
  session: DatabaseSession,
  video: Omit<ProductionExportMediaRow, 'relationshipId' | 'localeId' | 'role' | 'mediaKind' | 'dialogueId'>
): ProductionExportMediaRow[] {
  const records = session.db.select({ specSnapshotJson: mediaGenerationRuns.specSnapshotJson })
    .from(mediaGenerationRuns)
    .where(and(
      eq(mediaGenerationRuns.purpose, 'shot.video-take'),
      eq(mediaGenerationRuns.targetKind, 'sceneShotVideoTake'),
      eq(mediaGenerationRuns.targetId, video.takeId),
      eq(mediaGenerationRuns.status, 'completed')
    )).all();
  if (records.length === 0) {
    return [];
  }
  if (records.length > 1) {
    throw new ProjectDataError(
      'CORE_PRODUCTION_EXPORT_TAKE_SPEC_AMBIGUOUS',
      `Picked Shot Video Take has more than one current shot.video-take spec: ${video.takeId}.`
    );
  }
  const record = records[0]!;
  const references = (JSON.parse(record.specSnapshotJson) as GenerationSpec).references;
  return references.flatMap((reference) => {
    if (reference.placement.kind !== 'slot' ||
      reference.placement.slotId !== 'dialogue-audio' ||
      reference.reference.kind !== 'asset-file') {
      return [];
    }
    const dialogueId = reference.placement.subject?.kind === 'sceneDialogue'
      ? reference.placement.subject.id
      : null;
    if (!dialogueId) {
      throw invalidDialogueReference(video.takeId);
    }
    const row = session.db.select({
      takeId: sceneDialogueAudioTakes.id,
      dialogueId: sceneDialogueAudio.dialogueId,
      assetId: sceneDialogueAudioTakes.assetId,
      assetFileId: sceneDialogueAudioTakes.assetFileId,
      title: assets.title,
      sourceProjectRelativePath: assetFiles.projectRelativePath,
      sourceSizeBytes: assetFiles.sizeBytes,
      sourceContentHash: assetFiles.contentHash,
    }).from(sceneDialogueAudioTakes)
      .innerJoin(sceneDialogueAudio, eq(sceneDialogueAudio.id, sceneDialogueAudioTakes.sceneDialogueAudioId))
      .innerJoin(assets, eq(assets.id, sceneDialogueAudioTakes.assetId))
      .innerJoin(assetFiles, eq(assetFiles.id, sceneDialogueAudioTakes.assetFileId))
      .where(and(
        eq(sceneDialogueAudioTakes.assetId, reference.reference.assetId),
        eq(sceneDialogueAudioTakes.assetFileId, reference.reference.assetFileId),
        eq(sceneDialogueAudio.dialogueId, dialogueId),
        isNull(sceneDialogueAudioTakes.discardedAt),
        isNull(assets.discardedAt),
        isNull(assetFiles.discardedAt)
      )).get();
    if (!row) {
      throw invalidDialogueReference(video.takeId);
    }
    return [{
      assetId: row.assetId,
      relationshipId: `dialogue-audio:${row.takeId}`,
      assetFileId: row.assetFileId,
      localeId: null,
      role: 'dialogue-audio' as const,
      title: row.title,
      sourceProjectRelativePath: row.sourceProjectRelativePath,
      mediaKind: 'audio' as const,
      sourceSizeBytes: row.sourceSizeBytes,
      sourceContentHash: row.sourceContentHash,
      sequencePosition: video.sequencePosition,
      sequenceTitle: video.sequenceTitle,
      scenePosition: video.scenePosition,
      sceneTitle: video.sceneTitle,
      takeId: video.takeId,
      takeTitle: video.takeTitle,
      dialogueId,
    }];
  });
}

function invalidDialogueReference(takeId: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_PRODUCTION_EXPORT_DIALOGUE_REFERENCE_INVALID',
    `Picked Shot Video Take has an invalid Dialogue Audio reference: ${takeId}.`
  );
}

export function refreshProductionAssetFileMetadata(input: {
  session: DatabaseSession;
  assetFileId: string;
  contentHash: string;
  sizeBytes: number;
}): void {
  input.session.db.update(assetFiles).set({
    contentHash: input.contentHash,
    sizeBytes: input.sizeBytes,
    updatedAt: new Date().toISOString(),
  }).where(eq(assetFiles.id, input.assetFileId)).run();
}
