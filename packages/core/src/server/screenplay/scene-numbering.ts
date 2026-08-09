import { eq } from 'drizzle-orm';
import {
  allocateInitialProductionNumbers,
  productionNumberKey,
} from '../../client/production-numbers.js';
import type { Screenplay } from '../../client/screenplay/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { allocateProductionNumberOrThrow } from '../production-number-allocation.js';
import { agentSceneNumberReservations } from '../schema/index.js';
import { projectCanonicalScreenplayStructure } from './projections/structure.js';

export function numberInitialAgentScenes(input: {
  session: DatabaseSession;
  screenplay: Screenplay;
  now: string;
}): void {
  const ordered = projectCanonicalScreenplayStructure(input.screenplay).scenes;
  const numbers = allocateInitialProductionNumbers(ordered.length);
  ordered.forEach((scene, index) => {
    scene.productionNumber = numbers[index]!;
    reserve(input.session, scene.id, scene.productionNumber, input.now);
  });
}

export function reconcileAgentSceneNumbers(input: {
  session: DatabaseSession;
  screenplay: Screenplay;
  now: string;
}): void {
  const ordered = projectCanonicalScreenplayStructure(input.screenplay).scenes;
  const reservations = input.session.db.select().from(agentSceneNumberReservations).all();
  const bySceneId = new Map(reservations.map((row) => [row.sceneId, row.number]));
  const reservedNumbers = reservations.map((row) => row.number);
  const occupiedNumbers = ordered.flatMap((scene) =>
    scene.productionNumber !== undefined ? [scene.productionNumber] : []
  );
  for (let index = 0; index < ordered.length; index += 1) {
    const scene = ordered[index]!;
    const reserved = bySceneId.get(scene.id);
    if (reserved) {
      scene.productionNumber = reserved;
      continue;
    }
    if (scene.productionNumber !== undefined) {
      continue;
    }
    const generatedScenes = ordered.filter((candidate) => bySceneId.has(candidate.id));
    const generatedBefore = ordered
      .slice(0, index)
      .filter((candidate) => bySceneId.has(candidate.id)).length;
    const number = allocateProductionNumberOrThrow({
      orderedNumbers: generatedScenes.map((candidate) => bySceneId.get(candidate.id)!),
      reservedNumbers,
      occupiedNumbers,
      placement: generatedBefore === generatedScenes.length
        ? { position: 'end' }
        : { position: 'insert', index: generatedBefore },
    });
    scene.productionNumber = number;
    reservedNumbers.push(number);
    occupiedNumbers.push(number);
    reserve(input.session, scene.id, number, input.now);
  }
}

export function restoreAgentSceneNumbers(input: {
  session: DatabaseSession;
  screenplay: Screenplay;
}): void {
  for (const scene of input.screenplay.scenes) {
    const number = input.session.db
      .select({ number: agentSceneNumberReservations.number })
      .from(agentSceneNumberReservations)
      .where(eq(agentSceneNumberReservations.sceneId, scene.id))
      .get()?.number;
    if (number) {
      scene.productionNumber = number;
    }
  }
}

function reserve(
  session: DatabaseSession,
  sceneId: string,
  number: string,
  now: string
): void {
  try {
    session.db.insert(agentSceneNumberReservations).values({
      sceneId,
      number,
      numberKey: productionNumberKey(number),
      createdAt: now,
    }).run();
  } catch {
    throw new ProjectDataError(
      'SCREENPLAY_AGENT_SCENE_NUMBER_RESERVATION_CONFLICT',
      `Scene number ${number} could not be reserved for Scene ${sceneId}.`
    );
  }
}
