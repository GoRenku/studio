import type { SceneBeatSheetContextReport } from '../../../client/scene-beats/index.js';
import type {
  Scene,
  Screenplay,
  ScreenplaySection,
} from '../../../client/screenplay/index.js';
import type { ProductionLookbook } from '../../../client/visual-language.js';
import { listCastMemberRecords } from '../../database/access/cast-members.js';
import { readActiveSceneBeatSheetRecord, toSceneBeatSheetSummary } from '../../database/access/scene-beat-sheets.js';
import { listLocationRecords } from '../../database/access/locations.js';
import { readLookbookRecordByKind, toLookbook } from '../../database/access/lookbook.js';
import { listPropRecords } from '../../database/access/props.js';
import { readProjectInformationResourceFromDatabase } from '../../database/access/project-information.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ReadSceneBeatSheetContextInput } from '../../project-data-service-contracts.js';
import { sceneBeatSheetResourceKeys } from '../../scene-beat-sheet/storyboard-status.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';

export async function readSceneBeatSheetContext(
  input: ReadSceneBeatSheetContextInput,
): Promise<SceneBeatSheetContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = readCanonicalScreenplay(session);
    const scene = requireScene(screenplay, input.sceneId);
    const project = readProjectInformationResourceFromDatabase(session);
    const activeBeatSheet = readActiveSceneBeatSheetRecord(session, input.sceneId);
    const activeBeatSheetId = activeBeatSheet?.id ?? null;
    const subjects = collectSceneSubjectIds(screenplay, scene.id);
    return {
      valid: true,
      warnings: [],
      project: {
        projectName: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
        title: project.title,
        aspectRatio: project.aspectRatio,
        ...(project.logline ? { logline: project.logline } : {}),
        ...(project.synopsis ? { synopsis: project.synopsis } : {}),
        ...(project.premise ? { premise: project.premise } : {}),
        ...(project.primaryGenre ? { primaryGenre: project.primaryGenre } : {}),
        ...(project.secondaryGenres ? { secondaryGenres: project.secondaryGenres } : {}),
        ...(project.tones ? { tones: project.tones } : {}),
        ...(project.themes ? { themes: project.themes } : {}),
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.sceneId,
        beatSheetId: activeBeatSheetId,
      }),
      sections: collectContainingSections(screenplay, scene.id),
      scene,
      cast: listCastMemberRecords(session)
        .filter((member) => subjects.castMemberIds.has(member.id))
        .map((member) => ({
          id: member.id,
          name: member.name,
          isVoiceOver: member.isVoiceOver,
          ...(member.role ? { role: member.role } : {}),
          ...(member.description ? { description: member.description } : {}),
        })),
      locations: listLocationRecords(session)
        .filter((location) => subjects.locationIds.has(location.id))
        .map((location) => ({
          id: location.id,
          name: location.name,
          ...(location.timePeriod ? { timePeriod: location.timePeriod } : {}),
          ...(location.description ? { description: location.description } : {}),
          ...(location.visualNotes ? { visualNotes: location.visualNotes } : {}),
        })),
      props: listPropRecords(session)
        .filter((prop) => subjects.propIds.has(prop.id))
        .map((prop) => ({
          id: prop.id,
          name: prop.name,
          ...(prop.description ? { description: prop.description } : {}),
          ...(prop.visualNotes ? { visualNotes: prop.visualNotes } : {}),
        })),
      activeLookbook: readActiveLookbookContext(session),
      activeBeatSheet: activeBeatSheet
        ? toSceneBeatSheetSummary({
            row: activeBeatSheet,
            activeBeatSheetId,
          })
        : null,
      ...(input.includeVisualReferences
        ? {
            visualReferences: {
              note: 'Visual reference metadata is not included in context; inspect project assets when visual review is requested.',
            },
          }
        : {}),
    };
  });
}

function requireScene(screenplay: Screenplay, sceneId: string): Scene {
  const scene = screenplay.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new ProjectDataError('SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND', `Scene was not found: ${sceneId}.`, {
      suggestion: 'Use a Scene id from the Screenplay structure resource.',
    });
  }
  return scene;
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
  const sections: ScreenplaySection[] = [];
  let parentId = parentByContentId.get(sceneId);
  while (parentId) {
    const section = sectionById.get(parentId);
    if (!section) {
      break;
    }
    sections.unshift(section);
    parentId = parentByContentId.get(section.id);
  }
  return sections;
}

function collectSceneSubjectIds(screenplay: Screenplay, sceneId: string): {
  castMemberIds: Set<string>;
  locationIds: Set<string>;
  propIds: Set<string>;
} {
  const castMemberIds = new Set<string>();
  const locationIds = new Set<string>();
  const propIds = new Set<string>();
  for (const reference of screenplay.references) {
    if (!('sceneId' in reference.target) || reference.target.sceneId !== sceneId) {
      continue;
    }
    if (reference.subject.type === 'castMember') {
      castMemberIds.add(reference.subject.id);
    } else if (reference.subject.type === 'location') {
      locationIds.add(reference.subject.id);
    } else {
      propIds.add(reference.subject.id);
    }
  }
  return { castMemberIds, locationIds, propIds };
}

function readActiveLookbookContext(
  session: Parameters<typeof readLookbookRecordByKind>[0],
): SceneBeatSheetContextReport['activeLookbook'] {
  const row = readLookbookRecordByKind(session, 'production');
  if (!row) {
    return null;
  }
  const lookbook = toLookbook(row) as ProductionLookbook;
  const definition = lookbook.definition;
  return {
    id: lookbook.id,
    name: lookbook.name,
    thesis: JSON.stringify(definition.thesis),
    palette: JSON.stringify(definition.palette),
    camera: JSON.stringify(definition.camera),
    toneMood: JSON.stringify(definition.toneMood),
    texture: JSON.stringify(definition.texture),
    composition: JSON.stringify(definition.composition),
    lighting: JSON.stringify(definition.lighting),
  };
}
