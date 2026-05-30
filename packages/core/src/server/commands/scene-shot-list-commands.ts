import type {
  SceneShotListContextReport,
  SceneShotListListReport,
  SceneShotListReadReport,
  SceneShotListValidationReport,
  SceneShotListWriteReport,
} from '../../client/scene-shot-list.js';
import type {
  CastMember,
  Location,
  Scene,
  ScreenplayDocument,
} from '../../client/screenplay.js';
import {
  listSceneShotListRecords,
  readActiveSceneShotListId,
  readActiveSceneShotListRecord,
  readSceneShotListDocument,
  requireSceneShotListRecord,
  setActiveSceneShotListRecord,
  toSceneShotListSummary,
  writeSceneShotListRecord,
} from '../database/access/scene-shot-lists.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import {
  readActiveLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../database/access/lookbook.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ReadSceneShotListContextInput,
  ReadSceneShotListInput,
  SceneShotListProjectInput,
  SetActiveSceneShotListInput,
  ValidateSceneShotListInput,
  WriteSceneShotListInput,
} from '../project-data-service-contracts.js';
import { assertSceneShotListDocument } from '../scene-shot-list-json/validator.js';

export const SCENE_SHOT_LIST_RESOURCE_KEY = 'scene-shot-list';

export async function readSceneShotListContext(
  input: ReadSceneShotListContextInput
): Promise<SceneShotListContextReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const hierarchy = requireSceneHierarchy(screenplay, input.sceneId);
    const projectInfo = readProjectInformationResourceFromDatabase(session);
    const activeShotList = readActiveSceneShotListRecord(session, input.sceneId);
    const activeShotListId = activeShotList?.id ?? null;
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
        aspectRatio: projectInfo.aspectRatio ?? null,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: activeShotListId,
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
      activeShotList: activeShotList
        ? toSceneShotListSummary({
            row: activeShotList,
            screenplay,
            activeShotListId,
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

export async function listSceneShotLists(
  input: SceneShotListProjectInput & { sceneId: string }
): Promise<SceneShotListListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    requireSceneHierarchy(screenplay, input.sceneId);
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: readActiveSceneShotListId(session, input.sceneId),
      }),
      sceneId: input.sceneId,
      shotLists: listSceneShotListRecords({
        session,
        sceneId: input.sceneId,
        screenplay,
      }),
      activeShotListId: readActiveSceneShotListId(session, input.sceneId),
    };
  });
}

export async function readSceneShotList(
  input: ReadSceneShotListInput
): Promise<SceneShotListReadReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const row = input.active
      ? readActiveSceneShotListRecord(
          session,
          requiredSceneId(input.sceneId, '--scene')
        )
      : requireSceneShotListRecord(
          session,
          requiredShotListId(input.shotListId)
        );
    const activeShotListId = input.sceneId
      ? readActiveSceneShotListId(session, input.sceneId)
      : row
        ? readActiveSceneShotListId(session, row.sceneId)
        : null;
    if (!row) {
      return {
        valid: true,
        warnings: [],
        project: {
          name: currentProject.projectName,
          id: currentProject.projectId,
          projectFolder: currentProject.projectFolder,
        },
        resourceKeys: sceneShotListResourceKeys({
          sceneId: requiredSceneId(input.sceneId, '--scene'),
          shotListId: null,
        }),
        shotList: null,
        summary: null,
        activeShotListId: null,
      };
    }
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: row.sceneId,
        shotListId: row.id,
      }),
      shotList: readSceneShotListDocument({ row, screenplay }),
      summary: toSceneShotListSummary({
        row,
        screenplay,
        activeShotListId,
      }),
      activeShotListId,
    };
  });
}

export async function validateSceneShotList(
  input: ValidateSceneShotListInput
): Promise<SceneShotListValidationReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneShotListDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    return {
      valid: true,
      warnings,
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.document.sceneId,
        shotListId: readActiveSceneShotListId(session, input.document.sceneId),
      }),
      shotList: input.document,
    };
  });
}

export async function writeSceneShotList(
  input: WriteSceneShotListInput
): Promise<SceneShotListWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const warnings = assertSceneShotListDocument({
      document: input.document,
      screenplay,
      filePath: input.filePath,
    });
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const shotListId = ids('scene_shot_list');
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      writeSceneShotListRecord({
        session: txSession,
        id: shotListId,
        document: input.document,
        screenplay,
        now,
        filePath: input.filePath,
      });
      setActiveSceneShotListRecord(txSession, {
        sceneId: input.document.sceneId,
        shotListId,
        now,
      });
    });
    const row = requireSceneShotListRecord(session, shotListId);
    return {
      valid: true,
      warnings,
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.document.sceneId,
        shotListId,
      }),
      shotList: toSceneShotListSummary({
        row,
        screenplay,
        activeShotListId: shotListId,
      }),
      activeShotListId: shotListId,
      changes: [
        {
          type: 'sceneShotList.created',
          sceneId: input.document.sceneId,
          shotListId,
        },
        {
          type: 'sceneShotList.activeSet',
          sceneId: input.document.sceneId,
          shotListId,
        },
      ],
    };
  });
}

export async function setActiveSceneShotList(
  input: SetActiveSceneShotListInput
): Promise<SceneShotListWriteReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    setActiveSceneShotListRecord(session, {
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      now,
    });
    const row = requireSceneShotListRecord(session, input.shotListId);
    return {
      valid: true,
      warnings: [],
      project: {
        name: currentProject.projectName,
        id: currentProject.projectId,
        projectFolder: currentProject.projectFolder,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: input.shotListId,
      }),
      shotList: toSceneShotListSummary({
        row,
        screenplay,
        activeShotListId: input.shotListId,
      }),
      activeShotListId: input.shotListId,
      changes: [
        {
          type: 'sceneShotList.activeSet',
          sceneId: input.sceneId,
          shotListId: input.shotListId,
        },
      ],
    };
  });
}

export function sceneShotListResourceKeys(input: {
  sceneId: string;
  shotListId?: string | null;
  storyboardSheetId?: string;
  shotIds?: string[];
}): string[] {
  return [
    `surface:scene:${input.sceneId}:shots`,
    SCENE_SHOT_LIST_RESOURCE_KEY,
    ...(input.shotListId ? [`scene-shot-list:${input.shotListId}`] : []),
    ...(input.shotListId && input.storyboardSheetId
      ? [
          `scene-shot-list:${input.shotListId}:storyboard-sheet:${input.storyboardSheetId}`,
        ]
      : []),
    ...(input.shotListId
      ? (input.shotIds ?? []).map(
          (shotId) => `scene-shot-list:${input.shotListId}:shot:${shotId}`
        )
      : []),
    `scene:${input.sceneId}`,
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
  session: Parameters<typeof readActiveLookbookId>[0]
): SceneShotListContextReport['activeLookbook'] {
  const activeLookbookId = readActiveLookbookId(session);
  if (!activeLookbookId) {
    return null;
  }
  const lookbook = toLookbook(requireLookbookRecordById(session, activeLookbookId));
  return {
    id: lookbook.id,
    name: lookbook.name,
    thesis: JSON.stringify(lookbook.thesis),
    palette: JSON.stringify(lookbook.palette),
    camera: JSON.stringify(lookbook.camera),
    toneMood: JSON.stringify(lookbook.toneMood),
    texture: JSON.stringify(lookbook.texture),
    composition: JSON.stringify(lookbook.composition),
    lighting: JSON.stringify(lookbook.lighting),
  };
}

function requiredSceneId(value: string | undefined, flag: string): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('PROJECT_DATA327', 'Scene id is required.', {
    suggestion: `Pass ${flag} <scene-id>.`,
  });
}

function requiredShotListId(value: string | undefined): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('PROJECT_DATA328', 'Scene Shot List id is required.', {
    suggestion: 'Pass --shot-list <shot-list-id>.',
  });
}
