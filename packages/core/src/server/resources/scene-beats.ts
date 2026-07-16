import type {
  Asset,
  SceneBeatSheetResource,
  ScreenplayImageReference,
} from '../../client/index.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  listAssetRelationshipPage,
} from '../database/access/asset-relationships/index.js';
import {
  readActNavigationRow,
  readSceneNavigationContext,
} from '../database/access/navigation.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  readActiveSceneBeatSheetRecord,
} from '../database/access/scene-beat-sheets.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ReadSceneBeatSheetResourceInput } from '../project-data-service-contracts.js';
import { readSceneStoryboardProjection } from './storyboard-overviews.js';

export async function readSceneBeatSheetResource(
  input: ReadSceneBeatSheetResourceInput
): Promise<SceneBeatSheetResource> {
  const { session } = await openProjectSession(input);
  try {
    const context = readSceneNavigationContext(session, input.sceneId);
    if (!context) {
      throwNotFound('scene', input.sceneId);
    }
    const act = readActNavigationRow(session, context.sequence.actId);
    if (!act) {
      throwNotFound('act', context.sequence.actId);
    }
    const projection = readSceneStoryboardProjection(session, input.sceneId);
    const screenplay = requireScreenplayDocumentFromSession(session);
    return {
      scene: context.scene,
      sequence: context.sequence,
      act,
      projectAspectRatio: readProjectRecord(session)?.aspectRatio ?? null,
      activeBeatSheetId:
        readActiveSceneBeatSheetRecord(session, input.sceneId)?.id ?? null,
      activeBeatSheet: projection.document,
      storyboardImagesByBeatId: projection.imagesByBeatId,
      castMemberLabels: screenplay
        ? Object.fromEntries(
            screenplay.cast.map((castMember) => [castMember.id, castMember.name])
          )
        : {},
      castMemberImages: screenplay
        ? Object.fromEntries(
            screenplay.cast.flatMap((castMember) => {
              if (!castMember.id) {
                return [];
              }
              const image = firstCastMemberImage(session, castMember.id);
              return image ? [[castMember.id, image]] : [];
            })
          )
        : {},
      locationLabels: screenplay
        ? Object.fromEntries(
            screenplay.locations.map((location) => [location.id, location.name])
          )
        : {},
    };
  } finally {
    session.close();
  }
}

function firstCastMemberImage(
  session: DatabaseSession,
  castMemberId: string
): ScreenplayImageReference | undefined {
  const target = { kind: 'castMember' as const, castMemberId };
  const asset =
    listAssetRelationshipPage(session, {
      target,
      role: 'profile',
      mediaKind: 'image',
      limit: 1,
    }).items[0] ??
    listAssetRelationshipPage(session, {
      target,
      role: 'character-sheet',
      mediaKind: 'image',
      limit: 1,
    }).items[0] ??
    listAssetRelationshipPage(session, {
      target,
      mediaKind: 'image',
      limit: 1,
    }).items[0];
  return asset ? toScreenplayImageReference(asset) : undefined;
}

function toScreenplayImageReference(
  asset: Asset
): ScreenplayImageReference | undefined {
  const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
  if (!file) {
    return undefined;
  }
  return {
    assetId: asset.assetId,
    relationshipId: asset.relationshipId,
    assetFileId: file.id,
    title: asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  };
}

function requireScreenplayDocumentFromSession(
  session: DatabaseSession
): ScreenplayDocument {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'PROJECT_DATA012',
      'Project has no screenplay document.',
      { suggestion: 'Create or import a screenplay before editing beat references.' }
    );
  }
  return screenplay;
}

function throwNotFound(label: string, id: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA012',
    `Project ${label} was not found: ${id}.`
  );
}
