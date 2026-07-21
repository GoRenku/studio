import { asc, eq } from 'drizzle-orm';
import type {
  SceneProductionNumberListReport,
  SceneProductionNumberReference,
  SceneProductionNumberResolveReport,
} from '../../client/scene-production-numbers.js';
import { normalizeSceneProductionNumber } from '../../client/scene-production-numbers.js';
import { acts } from '../schema/acts.js';
import { sceneProductionNumbers } from '../schema/scene-production-numbers.js';
import { scenes } from '../schema/scenes.js';
import { sequences } from '../schema/sequences.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { studioScreenplayResourceKey } from '../studio-coordination/resource-keys.js';

export async function listSceneProductionNumbers(
  input: RenkuConfigPathOptions = {}
): Promise<SceneProductionNumberListReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => ({
    valid: true,
    warnings: [],
    project: { name: currentProject.projectName, id: currentProject.projectId },
    resourceKeys: [studioScreenplayResourceKey()],
    sceneNumbers: listCurrentSceneProductionNumbers(session),
  }));
}

export async function resolveSceneProductionNumber(
  input: RenkuConfigPathOptions & { productionNumber: string }
): Promise<SceneProductionNumberResolveReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const productionNumber = normalizeSceneProductionNumber(input.productionNumber);
    if (!productionNumber) {
      throw unknownNumberError(input.productionNumber);
    }
    const reservation = session.db
      .select({ sceneId: sceneProductionNumbers.sceneId })
      .from(sceneProductionNumbers)
      .where(eq(sceneProductionNumbers.productionNumber, productionNumber))
      .get();
    if (!reservation) {
      throw unknownNumberError(productionNumber);
    }
    const scene = session.db
      .select({ id: scenes.id, title: scenes.title })
      .from(scenes)
      .where(eq(scenes.id, reservation.sceneId))
      .get();
    if (!scene) {
      throw new ProjectDataError(
        'PROJECT_DATA448',
        `Production scene number ${productionNumber} is omitted.`,
        { suggestion: 'Select an active production scene number; omitted numbers remain reserved.' }
      );
    }
    return {
      valid: true,
      warnings: [],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      resourceKeys: [studioScreenplayResourceKey()],
      scene: { productionNumber, sceneId: scene.id, title: scene.title },
    };
  });
}

export function listCurrentSceneProductionNumbers(
  session: DatabaseSession
): SceneProductionNumberReference[] {
  const rows = session.db
    .select({
      sceneId: scenes.id,
      title: scenes.title,
      productionNumber: sceneProductionNumbers.productionNumber,
    })
    .from(scenes)
    .innerJoin(sequences, eq(scenes.sequenceId, sequences.id))
    .innerJoin(acts, eq(sequences.actId, acts.id))
    .leftJoin(sceneProductionNumbers, eq(sceneProductionNumbers.sceneId, scenes.id))
    .orderBy(
      asc(acts.position),
      asc(acts.id),
      asc(sequences.position),
      asc(sequences.id),
      asc(scenes.position),
      asc(scenes.id)
    )
    .all();
  return rows.map((row) => {
    if (!row.productionNumber) {
      throw integrityError(`Current scene ${row.sceneId} has no production number reservation.`);
    }
    if (normalizeSceneProductionNumber(row.productionNumber) !== row.productionNumber) {
      throw integrityError(`Scene ${row.sceneId} has noncanonical production number ${row.productionNumber}.`);
    }
    return {
      productionNumber: row.productionNumber,
      sceneId: row.sceneId,
      title: row.title,
    };
  });
}

function unknownNumberError(value: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA447',
    `Unknown production scene number: ${value}.`,
    { suggestion: 'List current numbers with `renku screenplay scene-number list --json`.' }
  );
}

function integrityError(message: string): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA450', message, {
    suggestion: 'Run project validation and repair production scene-number reservations through Core.',
  });
}
