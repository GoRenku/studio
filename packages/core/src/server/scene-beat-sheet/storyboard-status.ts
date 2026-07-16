import type {
  Beat,
  SceneBeatSheetDocument,
  SceneBeatSheetStoryboardBeatStatus,
  SceneBeatSheetStoryboardStatus,
} from '../../client/scene-beat-sheet.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';
import {
  readSceneBeatSheetDocument,
  requireSceneBeatSheetForScene,
} from '../database/access/scene-beat-sheets.js';
import {
  beatContentFingerprint,
  readLatestSceneBeatStoryboardImage,
  type SceneBeatStoryboardImageRecord,
} from '../database/access/scene-beat-storyboard-images.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ReadSceneBeatSheetStoryboardStatusInput } from '../project-data-service-contracts.js';
import {
  studioSceneNarrativeResourceKey,
  studioSceneBeatSheetResourceKey,
  studioBeatResourceKey,
  studioSceneBeatsResourceKey,
} from '../studio-coordination/resource-keys.js';

export const SCENE_BEAT_SHEET_RESOURCE_KEY = 'scene-beat-sheet';

export async function readSceneBeatSheetStoryboardStatus(
  input: ReadSceneBeatSheetStoryboardStatusInput
): Promise<SceneBeatSheetStoryboardStatus> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    requireSceneHierarchy(screenplay, input.sceneId);
    const row = requireSceneBeatSheetForScene({
      session,
      sceneId: input.sceneId,
      beatSheetId: input.beatSheetId,
    });
    return readSceneBeatSheetStoryboardStatusFromSession({
      session,
      currentProject,
      sceneId: input.sceneId,
      beatSheetId: input.beatSheetId,
      document: readSceneBeatSheetDocument({ row, screenplay }),
    });
  });
}

export function readDryRunSceneBeatSheetStoryboardStatusFromSession(input: {
  session: Parameters<typeof readLatestSceneBeatStoryboardImage>[0]['session'];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  baseBeatSheetId: string;
  beatSheetId: string;
  document: SceneBeatSheetDocument;
  preservedBeatIds: string[];
}): SceneBeatSheetStoryboardStatus {
  const preserved = new Set(input.preservedBeatIds);
  return buildSceneBeatSheetStoryboardStatus({
    currentProject: input.currentProject,
    sceneId: input.sceneId,
    beatSheetId: input.beatSheetId,
    document: input.document,
    readImageForBeat: (beat) => {
      if (!preserved.has(beat.id)) {
        return { image: null };
      }
      const image = readCurrentBaseStoryboardImageForBeat({
        session: input.session,
        baseBeatSheetId: input.baseBeatSheetId,
        beat,
      });
      return image ? { image, simulated: true } : { image: null };
    },
  });
}

export function readSceneBeatSheetStoryboardStatusFromSession(input: {
  session: Parameters<typeof readLatestSceneBeatStoryboardImage>[0]['session'];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  beatSheetId: string;
  document: SceneBeatSheetDocument;
}): SceneBeatSheetStoryboardStatus {
  return buildSceneBeatSheetStoryboardStatus({
    currentProject: input.currentProject,
    sceneId: input.sceneId,
    beatSheetId: input.beatSheetId,
    document: input.document,
    readImageForBeat: (beat) => ({
      image: readLatestSceneBeatStoryboardImage({
        session: input.session,
        beatSheetId: input.beatSheetId,
        beatId: beat.id,
      }),
    }),
  });
}

export function readCurrentBaseStoryboardImageForBeat(input: {
  session: Parameters<typeof readLatestSceneBeatStoryboardImage>[0]['session'];
  baseBeatSheetId: string;
  beat: Beat;
}): SceneBeatStoryboardImageRecord | null {
  const image = readLatestSceneBeatStoryboardImage({
    session: input.session,
    beatSheetId: input.baseBeatSheetId,
    beatId: input.beat.id,
  });
  if (!image || image.beatContentFingerprint !== beatContentFingerprint(input.beat)) {
    return null;
  }
  return image;
}

function buildSceneBeatSheetStoryboardStatus(input: {
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  beatSheetId: string;
  document: SceneBeatSheetDocument;
  readImageForBeat: (beat: Beat) => {
    image: SceneBeatStoryboardImageRecord | null;
    simulated?: boolean;
  };
}): SceneBeatSheetStoryboardStatus {
  const beats: SceneBeatSheetStoryboardBeatStatus[] = input.document.beats.map((beat) => {
    const { image, simulated } = input.readImageForBeat(beat);
    const currentFingerprint = beatContentFingerprint(beat);
    const isCurrentForBeat =
      image?.beatContentFingerprint === currentFingerprint;
    return {
      beatId: beat.id,
      image: image
        ? {
            storyboardImageId: image.id,
            assetId: image.assetId,
            assetFileId: image.assetFileId,
            sourcePurpose: image.sourcePurpose,
            isCurrentForBeat,
            ...(simulated ? { simulated } : {}),
          }
        : null,
      needsStoryboardImage: !image || !isCurrentForBeat,
      ...(!image
        ? { reason: 'missing' as const }
        : !isCurrentForBeat
          ? { reason: 'beat-changed' as const }
          : {}),
    };
  });
  return {
    valid: true,
    warnings: [],
    project: {
      name: input.currentProject.projectName,
      id: input.currentProject.projectId,
      projectFolder: input.currentProject.projectFolder,
    },
    resourceKeys: sceneBeatSheetResourceKeys({
      sceneId: input.sceneId,
      beatSheetId: input.beatSheetId,
      beatIds: beats.map((beat) => beat.beatId),
    }),
    sceneId: input.sceneId,
    beatSheetId: input.beatSheetId,
    beats,
    missingBeatIds: beats
      .filter((beat) => beat.reason === 'missing')
      .map((beat) => beat.beatId),
    staleBeatIds: beats
      .filter((beat) => beat.reason === 'beat-changed')
      .map((beat) => beat.beatId),
    readyBeatIds: beats
      .filter((beat) => !beat.needsStoryboardImage)
      .map((beat) => beat.beatId),
  };
}

export function sceneBeatSheetResourceKeys(input: {
  sceneId: string;
  beatSheetId?: string | null;
  beatIds?: string[];
}): string[] {
  return [
    studioSceneBeatsResourceKey(input.sceneId),
    SCENE_BEAT_SHEET_RESOURCE_KEY,
    ...(input.beatSheetId ? [studioSceneBeatSheetResourceKey(input.beatSheetId)] : []),
    ...(input.beatSheetId
      ? (input.beatIds ?? []).map(
          (beatId) => studioBeatResourceKey(input.beatSheetId as string, beatId)
        )
      : []),
    studioSceneNarrativeResourceKey(input.sceneId),
  ];
}

function requireScreenplayDocument(
  session: Parameters<typeof readScreenplayDocumentFromSession>[0]
): ScreenplayDocument {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Use `renku screenplay create` first.',
    });
  }
  return screenplay;
}

function requireSceneHierarchy(
  screenplay: ScreenplayDocument,
  sceneId: string
): void {
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      if (sequence.scenes.some((scene) => scene.id === sceneId)) {
        return;
      }
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA326',
    `Scene was not found: ${sceneId}.`,
    {
      suggestion:
        'Use a scene id from `renku screenplay scene list --sequence <sequence-id> --json`.',
    }
  );
}
