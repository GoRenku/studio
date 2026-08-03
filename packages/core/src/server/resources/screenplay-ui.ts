import type {
  SceneNarrativeResource,
} from '../../client/index.js';
import type { Screenplay, ScreenplaySection } from '../../client/screenplay/index.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listLocationRecords } from '../database/access/locations.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type {
  ReadSceneNarrativeResourceInput,
} from '../project-data-service-contracts.js';
import { readSceneDialogueAudioWorkspace } from '../scene-dialogue-audio-workspace/context.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { projectScreenplayScene } from '../screenplay/projections/scene.js';
import { firstImageForContinuitySubject } from './continuity-subjects.js';

export async function readSceneNarrativeResource(
  input: ReadSceneNarrativeResourceInput
): Promise<SceneNarrativeResource> {
  const { session } = await openProjectSession(input);
  try {
    const screenplay = readCanonicalScreenplay(session);
    const scene = projectScreenplayScene(screenplay, input.sceneId);
    const castMemberIds = subjectIds(scene.references, 'castMember');
    const locationIds = subjectIds(scene.references, 'location');
    const castMembers = listCastMemberRecords(session).filter((member) => castMemberIds.has(member.id));
    const locations = listLocationRecords(session).filter((location) => locationIds.has(location.id));
    return {
      scene,
      sections: collectContainingSections(screenplay, input.sceneId),
      castMemberLabels: Object.fromEntries(castMembers.map((member) => [member.id, member.name])),
      castMemberImages: Object.fromEntries(
        castMembers.flatMap((member) => {
          const image = firstImageForContinuitySubject(session, { kind: 'castMember', id: member.id });
          return image ? [[member.id, image]] : [];
        }),
      ),
      locationLabels: Object.fromEntries(locations.map((location) => [location.id, location.name])),
      locationImages: Object.fromEntries(
        locations.flatMap((location) => {
          const image = firstImageForContinuitySubject(session, { kind: 'location', id: location.id });
          return image ? [[location.id, image]] : [];
        }),
      ),
      dialogueAudio: readSceneDialogueAudioWorkspace({ session, sceneId: input.sceneId }),
    };
  } finally {
    session.close();
  }
}

function subjectIds(
  references: ReturnType<typeof projectScreenplayScene>['references'],
  type: 'castMember' | 'location',
): Set<string> {
  return new Set(
    references.flatMap((reference) => reference.subject.type === type ? [reference.subject.id] : []),
  );
}

function collectContainingSections(
  screenplay: Screenplay,
  sceneId: string,
): ScreenplaySection[] {
  const sectionById = new Map(screenplay.sections.map((section) => [section.id, section]));
  const parentByContentId = new Map(screenplay.structure.map((entry) => [
    entry.content.type === 'scene' ? entry.content.sceneId : entry.content.sectionId,
    entry.parentSectionId,
  ]));
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
