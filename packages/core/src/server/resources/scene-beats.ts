import type {
  Asset,
  SceneBeatsResource,
  ScreenplayBeatGalleryResource,
  ScreenplayImageReference,
} from '../../client/index.js';
import type { Screenplay, ScreenplaySection } from '../../client/screenplay/index.js';
import { listAssetPageInSession } from '../assets/projection.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listLocationRecords } from '../database/access/locations.js';
import { listPropRecords } from '../database/access/props.js';
import { readProjectRecord } from '../database/access/project.js';
import { readActiveSceneBeatsRevisionRecord } from '../database/access/scene-beats.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ReadProjectInput,
  ReadSceneBeatsResourceInput,
} from '../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { projectScreenplayScene } from '../screenplay/projections/scene.js';
import { projectCanonicalScreenplayStructure } from '../screenplay/projections/structure.js';
import { readSceneStoryboardProjection } from './storyboard-overviews.js';

export async function readSceneBeatsResource(
  input: ReadSceneBeatsResourceInput
): Promise<SceneBeatsResource> {
  const { session } = await openProjectSession(input);
  try {
    const screenplay = readCanonicalScreenplay(session);
    const scene = projectScreenplayScene(screenplay, input.sceneId);
    const projection = readSceneStoryboardProjection(session, input.sceneId);
    const castMemberIds = subjectIds(scene.references, 'castMember');
    const locationIds = subjectIds(scene.references, 'location');
    const propIds = subjectIds(scene.references, 'prop');
    const castMembers = listCastMemberRecords(session).filter((member) => castMemberIds.has(member.id));
    return {
      scene,
      sections: collectContainingSections(screenplay, input.sceneId),
      projectAspectRatio: readProjectRecord(session)?.aspectRatio ?? null,
      activeRevisionId: readActiveSceneBeatsRevisionRecord(session, input.sceneId)?.id ?? null,
      activeRevision: projection.document,
      storyboardImagesByBeatId: projection.imagesByBeatId,
      castMemberLabels: Object.fromEntries(castMembers.map((member) => [member.id, member.name])),
      castMemberImages: Object.fromEntries(
        castMembers.flatMap((member) => {
          const image = firstCastMemberImage(session, member.id);
          return image ? [[member.id, image]] : [];
        }),
      ),
      locationLabels: Object.fromEntries(
        listLocationRecords(session)
          .filter((location) => locationIds.has(location.id))
          .map((location) => [location.id, location.name]),
      ),
      propLabels: Object.fromEntries(
        listPropRecords(session)
          .filter((prop) => propIds.has(prop.id))
          .map((prop) => [prop.id, prop.name]),
      ),
    };
  } finally {
    session.close();
  }
}

export async function readScreenplayBeatGalleryResource(
  input: ReadProjectInput
): Promise<ScreenplayBeatGalleryResource> {
  const { session } = await openProjectSession(input);
  try {
    const screenplay = readCanonicalScreenplay(session);
    const orderedScenes = projectCanonicalScreenplayStructure(screenplay).scenes;
    return {
      projectAspectRatio: readProjectRecord(session)?.aspectRatio ?? null,
      scenes: orderedScenes.flatMap((scene) => {
        const projection = readSceneStoryboardProjection(session, scene.id);
        const beats = (projection.document?.beats ?? []).flatMap((beat) => {
          const image = projection.imagesByBeatId[beat.id];
          return image
            ? [{
                beat: {
                  id: beat.id,
                  number: beat.number,
                  title: beat.title,
                },
                image,
              }]
            : [];
        });
        return beats.length
          ? [{
              scene: {
                id: scene.id,
                productionNumber: scene.productionNumber,
                heading: scene.heading,
                title: scene.title,
              },
              beats,
            }]
          : [];
      }),
    };
  } finally {
    session.close();
  }
}

function subjectIds(
  references: ReturnType<typeof projectScreenplayScene>['references'],
  type: 'castMember' | 'location' | 'prop',
): Set<string> {
  return new Set(references.flatMap((reference) => reference.subject.type === type ? [reference.subject.id] : []));
}

function collectContainingSections(screenplay: Screenplay, sceneId: string): ScreenplaySection[] {
  const sectionById = new Map(screenplay.sections.map((section) => [section.id, section]));
  const parentByContentId = new Map(screenplay.structure.map((entry) => [entry.id, entry.parentSectionId]));
  const result: ScreenplaySection[] = [];
  let parentId = parentByContentId.get(sceneId);
  while (parentId) {
    const section = sectionById.get(parentId);
    if (!section) {
      break;
    }
    result.unshift(section);
    parentId = parentByContentId.get(section.id);
  }
  return result;
}

function firstCastMemberImage(
  session: DatabaseSession,
  castMemberId: string
): ScreenplayImageReference | undefined {
  const page = listAssetPageInSession(session, {
    owner: { kind: 'castMember', id: castMemberId },
    type: 'cast_profile',
    mediaKind: 'image',
  });
  const asset = page.items.find((candidate) => candidate.id === page.selectedAssetId);
  return asset ? toScreenplayImageReference(asset) : undefined;
}

function toScreenplayImageReference(asset: Asset): ScreenplayImageReference | undefined {
  const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
  return file ? {
    assetId: asset.id,
    assetFileId: file.id,
    title: asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  } : undefined;
}
