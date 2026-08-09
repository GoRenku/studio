import type {
  SceneBeats,
  SceneStoryboardStatus,
} from '../../client/scene-beats/index.js';
import type { Screenplay } from '../../client/screenplay/index.js';
import {
  readSceneBeats,
  requireSceneBeatsRevisionForScene,
} from '../database/access/scene-beats.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ReadSceneStoryboardStatusInput } from '../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { listAssetPageInSession } from '../assets/projection.js';
import {
  studioSceneNarrativeResourceKey,
  studioSceneBeatsRevisionResourceKey,
  studioBeatResourceKey,
  studioSceneBeatsResourceKey,
} from '../studio-coordination/resource-keys.js';

export const SCENE_BEATS_RESOURCE_KEY = 'scene-beats';

export async function readSceneStoryboardStatus(
  input: ReadSceneStoryboardStatusInput
): Promise<SceneStoryboardStatus> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplay(session);
    requireSceneHierarchy(screenplay, input.sceneId);
    const row = requireSceneBeatsRevisionForScene({
      session,
      sceneId: input.sceneId,
      revisionId: input.sceneBeatsRevisionId,
    });
    return readSceneStoryboardStatusFromSession({
      session,
      currentProject,
      sceneId: input.sceneId,
      sceneBeatsRevisionId: input.sceneBeatsRevisionId,
      sceneBeats: readSceneBeats({ row }),
    });
  });
}

export function readDryRunSceneStoryboardStatusFromSession(input: {
  session: Parameters<typeof listAssetPageInSession>[0];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  sceneBeatsRevisionId: string;
  sceneBeats: SceneBeats;
  persistedBeatIds: string[];
}): SceneStoryboardStatus {
  const persistedBeatIds = new Set(input.persistedBeatIds);
  return buildSceneStoryboardStatus(input, (beatId) => persistedBeatIds.has(beatId)
    ? listBeatStoryboardAssets(input, beatId)
    : { items: [], selectedAssetId: null });
}

export function readSceneStoryboardStatusFromSession(input: {
  session: Parameters<typeof listAssetPageInSession>[0];
  currentProject: { projectName: string; projectId?: string; projectFolder?: string };
  sceneId: string;
  sceneBeatsRevisionId: string;
  sceneBeats: SceneBeats;
}): SceneStoryboardStatus {
  return buildSceneStoryboardStatus(input, (beatId) =>
    listBeatStoryboardAssets(input, beatId));
}

function buildSceneStoryboardStatus(
  input: {
    currentProject: { projectName: string; projectId?: string; projectFolder?: string };
    sceneId: string;
    sceneBeatsRevisionId: string;
    sceneBeats: SceneBeats;
  },
  readAssets: (beatId: string) => {
    items: SceneStoryboardStatus['beats'][number]['images'];
    selectedAssetId: string | null;
  }
): SceneStoryboardStatus {
  const beats = input.sceneBeats.beats.map((beat) => {
    const page = readAssets(beat.id);
    return {
      beatId: beat.id,
      beatNumber: beat.number,
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
    resourceKeys: sceneBeatsResourceKeys({
      sceneId: input.sceneId,
      sceneBeatsRevisionId: input.sceneBeatsRevisionId,
      beatIds: beats.map((beat) => beat.beatId),
    }),
    sceneId: input.sceneId,
    sceneBeatsRevisionId: input.sceneBeatsRevisionId,
    beats,
    missingBeatIds: beats
      .filter((beat) => beat.selectedImageId === null)
      .map((beat) => beat.beatId),
    readyBeatIds: beats
      .filter((beat) => beat.selectedImageId !== null)
      .map((beat) => beat.beatId),
  };
}

function listBeatStoryboardAssets(
  input: {
    session: Parameters<typeof listAssetPageInSession>[0];
    sceneId: string;
  },
  beatId: string
) {
  return listAssetPageInSession(input.session, {
    owner: { kind: 'sceneBeat', sceneId: input.sceneId, beatId },
    type: 'scene_storyboard_image',
  });
}

export function sceneBeatsResourceKeys(input: {
  sceneId: string;
  sceneBeatsRevisionId?: string | null;
  beatIds?: string[];
}): string[] {
  return [
    studioSceneBeatsResourceKey(input.sceneId),
    SCENE_BEATS_RESOURCE_KEY,
    ...(input.sceneBeatsRevisionId ? [studioSceneBeatsRevisionResourceKey(input.sceneBeatsRevisionId)] : []),
    ...(input.sceneBeatsRevisionId
      ? (input.beatIds ?? []).map(
          (beatId) => studioBeatResourceKey(input.sceneBeatsRevisionId as string, beatId)
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
