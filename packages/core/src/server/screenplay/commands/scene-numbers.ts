import type {
  SceneProductionNumberListReport,
  SceneProductionNumberReference,
  SceneProductionNumberResolveReport,
} from '../../../client/screenplay/index.js';
import { readProjectRecord } from '../../database/access/project.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { studioScreenplayResourceKey } from '../../studio-coordination/resource-keys.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';

export async function listSceneProductionNumbers(
  input: RenkuConfigPathOptions & { projectName: string },
): Promise<SceneProductionNumberListReport> {
  const { session } = await openProjectSession(input);
  try {
    return {
      project: projectReference(session),
      sceneNumbers: readCanonicalScreenplay(session).scenes
        .filter((scene) => scene.productionNumber !== undefined)
        .map(toNumberReference),
      resourceKeys: [studioScreenplayResourceKey()],
    };
  } finally {
    session.close();
  }
}

export async function resolveSceneProductionNumber(
  input: RenkuConfigPathOptions & {
    projectName: string;
    productionNumber: string;
  },
): Promise<SceneProductionNumberResolveReport> {
  const { session } = await openProjectSession(input);
  try {
    const scene = readCanonicalScreenplay(session).scenes.find(
      (value) => value.productionNumber === input.productionNumber,
    );
    if (!scene || scene.productionNumber === undefined) {
      throw new ProjectDataError(
        'SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND',
        `No current Scene has production number ${input.productionNumber}.`,
        { suggestion: 'List current Scene numbers and use an exact value.' },
      );
    }
    return {
      project: projectReference(session),
      scene: toNumberReference(scene),
      resourceKeys: [studioScreenplayResourceKey()],
    };
  } finally {
    session.close();
  }
}

function toNumberReference(scene: {
  id: string;
  productionNumber?: string;
  heading: string;
  title?: string;
}): SceneProductionNumberReference {
  return {
    productionNumber: scene.productionNumber!,
    sceneId: scene.id,
    heading: scene.heading,
    ...(scene.title ? { title: scene.title } : {}),
  };
}

function projectReference(
  session: Parameters<typeof readProjectRecord>[0],
): { id: string; projectName: string } {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`,
    );
  }
  return { id: project.id, projectName: project.projectName };
}
