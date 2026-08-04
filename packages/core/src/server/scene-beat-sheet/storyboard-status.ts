import type {
  SceneBeatSheetDocument,
  SceneBeatSheetStoryboardStatus,
} from '../../client/scene-beats/index.js';
import type { Screenplay } from '../../client/screenplay/index.js';
import {
  readActiveSceneBeatSheetRecord,
  readSceneBeatSheetDocument,
  requireSceneBeatSheetForScene,
} from '../database/access/scene-beat-sheets.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ReadSceneBeatSheetStoryboardStatusInput } from '../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { listAssetPageInSession } from '../assets/projection.js';
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
    const screenplay = requireScreenplay(session);
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
      document: readSceneBeatSheetDocument({ row }),
    });
  });
}

export function readDryRunSceneBeatSheetStoryboardStatusFromSession(input: {
  session: Parameters<typeof listAssetPageInSession>[0];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  beatSheetId: string;
  document: SceneBeatSheetDocument;
}): SceneBeatSheetStoryboardStatus {
  return readSceneBeatSheetStoryboardStatusFromSession(input);
}

export function readSceneBeatSheetStoryboardStatusFromSession(input: {
  session: Parameters<typeof listAssetPageInSession>[0];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  beatSheetId: string;
  document: SceneBeatSheetDocument;
}): SceneBeatSheetStoryboardStatus {
  const currentBeatIds = readCurrentBeatIds(input.session, input.sceneId);
  const beats = input.document.beats.map((beat) => {
    const page =
      !currentBeatIds.has(beat.id)
        ? { items: [], selectedAssetId: null }
        : listAssetPageInSession(input.session, {
            owner: { kind: 'sceneBeat', sceneId: input.sceneId, beatId: beat.id },
            type: 'scene_storyboard_image',
          });
    return {
      beatId: beat.id,
      images: page.items,
      selectedImageId: page.selectedAssetId,
      needsStoryboardImage: page.selectedAssetId === null,
      ...(page.selectedAssetId === null ? { reason: 'missing' as const } : {}),
    };
  });
  return {
    valid: true,
    warnings: [],
    project: {
      projectName: input.currentProject.projectName,
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
      .filter((beat) => beat.selectedImageId === null)
      .map((beat) => beat.beatId),
    readyBeatIds: beats
      .filter((beat) => beat.selectedImageId !== null)
      .map((beat) => beat.beatId),
  };
}

function readCurrentBeatIds(
  session: Parameters<typeof listAssetPageInSession>[0],
  sceneId: string
): ReadonlySet<string> {
  const active = readActiveSceneBeatSheetRecord(session, sceneId);
  if (!active) {
    return new Set();
  }
  return new Set(
    readSceneBeatSheetDocument({ row: active }).beats.map(
      (beat) => beat.id
    )
  );
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

function requireScreenplay(
  session: Parameters<typeof readCanonicalScreenplay>[0]
): Screenplay {
  return readCanonicalScreenplay(session);
}

function requireSceneHierarchy(
  screenplay: Screenplay,
  sceneId: string
): void {
  if (screenplay.scenes.some((scene) => scene.id === sceneId)) {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA326',
    `Scene was not found: ${sceneId}.`,
    {
      suggestion:
        'Use a Scene id from the Screenplay structure resource.',
    }
  );
}
