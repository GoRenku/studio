import { and, desc, eq } from 'drizzle-orm';
import type {
  Beat,
  SceneBeatSheetDocument,
} from '../../../client/scene-beat-sheet.js';
import { ProjectDataError } from '../../project-data-error.js';
import { sceneBeatStoryboardImages } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneBeatStoryboardImageRecord =
  typeof sceneBeatStoryboardImages.$inferSelect;

export function insertSceneBeatStoryboardImageRecord(
  session: DatabaseSession,
  input: {
    id: string;
    sceneId: string;
    beatSheetId: string;
    beatId: string;
    assetId: string;
    assetFileId: string;
    sourcePurpose: string;
    beatContentFingerprint: string;
    now: string;
  }
): SceneBeatStoryboardImageRecord {
  session.db
    .insert(sceneBeatStoryboardImages)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      beatSheetId: input.beatSheetId,
      beatId: input.beatId,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      sourcePurpose: input.sourcePurpose,
      beatContentFingerprint: input.beatContentFingerprint,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  const image = readSceneBeatStoryboardImageRecord(session, input.id);
  if (!image) {
    throw new ProjectDataError(
      'PROJECT_DATA324',
      `Scene storyboard image was not found after insert: ${input.id}.`
    );
  }
  return image;
}

export function readSceneBeatStoryboardImageRecord(
  session: DatabaseSession,
  id: string
): SceneBeatStoryboardImageRecord | null {
  return (
    session.db
      .select()
      .from(sceneBeatStoryboardImages)
      .where(eq(sceneBeatStoryboardImages.id, id))
      .get() ?? null
  );
}

export function listSceneBeatStoryboardImageRecords(
  session: DatabaseSession,
  input: { beatSheetId: string }
): SceneBeatStoryboardImageRecord[] {
  return session.db
    .select()
    .from(sceneBeatStoryboardImages)
    .where(eq(sceneBeatStoryboardImages.beatSheetId, input.beatSheetId))
    .orderBy(
      desc(sceneBeatStoryboardImages.createdAt),
      desc(sceneBeatStoryboardImages.id)
    )
    .all();
}

export function readSceneBeatStoryboardImageByAssetId(
  session: DatabaseSession,
  assetId: string
): SceneBeatStoryboardImageRecord | null {
  return (
    session.db
      .select()
      .from(sceneBeatStoryboardImages)
      .where(eq(sceneBeatStoryboardImages.assetId, assetId))
      .get() ?? null
  );
}

export function deleteSceneBeatStoryboardImageByAssetId(
  session: DatabaseSession,
  assetId: string
): void {
  session.db
    .delete(sceneBeatStoryboardImages)
    .where(eq(sceneBeatStoryboardImages.assetId, assetId))
    .run();
}

export function readLatestSceneBeatStoryboardImage(input: {
  session: DatabaseSession;
  beatSheetId: string;
  beatId: string;
}): SceneBeatStoryboardImageRecord | null {
  return (
    input.session.db
      .select()
      .from(sceneBeatStoryboardImages)
      .where(
        and(
          eq(sceneBeatStoryboardImages.beatSheetId, input.beatSheetId),
          eq(sceneBeatStoryboardImages.beatId, input.beatId)
        )
      )
      .orderBy(
        desc(sceneBeatStoryboardImages.createdAt),
        desc(sceneBeatStoryboardImages.id)
      )
      .get() ?? null
  );
}

export function beatContentFingerprint(beat: Beat): string {
  return JSON.stringify({
    title: beat.title,
    description: beat.description,
    narrativeDevelopment: beat.narrativeDevelopment,
    narrativePurpose: beat.narrativePurpose,
    castMemberIds: beat.castMemberIds,
    locationIds: beat.locationIds,
    screenplayBlockIndexes: beat.screenplayBlockIndexes,
  });
}

export function assertBeatIdsExistInBeatSheet(input: {
  beatSheet: SceneBeatSheetDocument;
  beatIds: string[];
}): void {
  const validBeatIds = new Set(input.beatSheet.beats.map((beat) => beat.id));
  const missing = input.beatIds.find((beatId) => !validBeatIds.has(beatId));
  if (missing) {
    throw new ProjectDataError(
      'PROJECT_DATA325',
      `Storyboard import references a Beat id that is not in the Scene Beat Sheet: ${missing}.`,
      {
        suggestion:
          'Use Beat ids from `renku screenplay beat-sheet show --beat-sheet <id> --json`.',
      }
    );
  }
}
