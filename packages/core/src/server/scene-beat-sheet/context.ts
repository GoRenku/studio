import type { SceneBeatSheetContextReport } from '../../client/scene-beat-sheet.js';
import type {
  CastMember,
  Location,
  Scene,
  ScreenplayDocument,
} from '../../client/screenplay.js';
import type { ProductionLookbook } from '../../client/visual-language.js';
import {
  readActiveSceneBeatSheetRecord,
  toSceneBeatSheetSummary,
} from '../database/access/scene-beat-sheets.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { readLookbookRecordByKind, toLookbook } from '../database/access/lookbook.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ReadSceneBeatSheetContextInput } from '../project-data-service-contracts.js';
import { sceneBeatSheetResourceKeys } from './storyboard-status.js';

export async function readSceneBeatSheetContext(
  input: ReadSceneBeatSheetContextInput
): Promise<SceneBeatSheetContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const hierarchy = requireSceneHierarchy(screenplay, input.sceneId);
    const projectInfo = readProjectInformationResourceFromDatabase(session);
    const activeBeatSheet = readActiveSceneBeatSheetRecord(session, input.sceneId);
    const activeBeatSheetId = activeBeatSheet?.id ?? null;
    const activeLookbook = readActiveLookbookContext(session);
    const references = collectSceneReferences(hierarchy.scene, screenplay);
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
        title: projectInfo.title,
        aspectRatio: projectInfo.aspectRatio ?? '16:9',
      },
      resourceKeys: sceneBeatSheetResourceKeys({
        sceneId: input.sceneId,
        beatSheetId: activeBeatSheetId,
      }),
      screenplay: {
        title: screenplay.screenplay.title,
        logline: screenplay.screenplay.logline,
        summary: screenplay.screenplay.summary,
        genrePrimary: screenplay.screenplay.genrePrimary,
        genreSecondary: screenplay.screenplay.genreSecondary,
        tone: screenplay.screenplay.tone,
        themes: screenplay.screenplay.themes,
      },
      act: {
        id: hierarchy.act.id as string,
        title: hierarchy.act.title,
        purpose: hierarchy.act.purpose,
      },
      sequence: {
        id: hierarchy.sequence.id as string,
        title: hierarchy.sequence.title,
        purpose: hierarchy.sequence.purpose,
      },
      scene: {
        id: hierarchy.scene.id as string,
        title: hierarchy.scene.title,
        setting: hierarchy.scene.setting,
        storyFunction: hierarchy.scene.storyFunction ?? [],
        blocks: hierarchy.scene.blocks,
      },
      cast: references.cast.map((castMember) => ({
        id: castMember.id as string,
        handle: castMember.handle,
        name: castMember.name,
        isVoiceOver: castMember.isVoiceOver,
        role: castMember.role,
        description: castMember.description,
      })),
      locations: references.locations.map((location) => ({
        id: location.id as string,
        handle: location.handle,
        name: location.name,
        timePeriod: location.timePeriod,
        description: location.description,
        visualNotes: location.visualNotes,
      })),
      activeLookbook,
      activeBeatSheet: activeBeatSheet
        ? toSceneBeatSheetSummary({
            row: activeBeatSheet,
            screenplay,
            activeBeatSheetId,
          })
        : null,
      ...(input.includeVisualReferences
        ? {
            visualReferences: {
              note: 'Visual reference metadata is not included in v1 context; inspect project assets separately when the user explicitly asks for visual inspection.',
            },
          }
        : {}),
    };
  });
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
) {
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id === sceneId) {
          return { act, sequence, scene };
        }
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

function collectSceneReferences(
  scene: Scene,
  screenplay: ScreenplayDocument
): { cast: CastMember[]; locations: Location[] } {
  const castMemberIds = new Set<string>();
  const locationIds = new Set<string>(scene.setting.locationIds ?? []);
  for (const block of scene.blocks) {
    for (const castMemberId of block.castMemberIds ?? []) {
      castMemberIds.add(castMemberId);
    }
    if (block.type === 'dialogue' && block.castMemberId) {
      castMemberIds.add(block.castMemberId);
    }
    for (const locationId of block.locationIds ?? []) {
      locationIds.add(locationId);
    }
  }
  return {
    cast: screenplay.cast.filter(
      (castMember): castMember is CastMember & { id: string } =>
        Boolean(castMember.id && castMemberIds.has(castMember.id))
    ),
    locations: screenplay.locations.filter(
      (location): location is Location & { id: string } =>
        Boolean(location.id && locationIds.has(location.id))
    ),
  };
}

function readActiveLookbookContext(
  session: Parameters<typeof readLookbookRecordByKind>[0]
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
