import type { ScreenplayDocument } from '../../client/screenplay.js';
import { normalizeSceneProductionNumber } from '../../client/scene-production-numbers.js';
import { ProjectDataError } from '../project-data-error.js';

export interface SceneProductionNumberReservation {
  productionNumber: string;
  sceneId: string;
}

export interface SceneProductionNumberAllocation {
  productionNumber: string;
  sceneId: string;
}

export function screenplaySceneIds(document: ScreenplayDocument | null): string[] {
  return document?.acts.flatMap((act) =>
    act.sequences.flatMap((sequence) =>
      sequence.scenes.map((scene) => requireSceneId(scene.id))
    )
  ) ?? [];
}

export function planSceneProductionNumberAllocations(input: {
  beforeSceneIds: string[];
  afterSceneIds: string[];
  reservations: SceneProductionNumberReservation[];
}): SceneProductionNumberAllocation[] {
  assertUniqueSceneIds(input.beforeSceneIds, 'before screenplay');
  assertUniqueSceneIds(input.afterSceneIds, 'after screenplay');

  const numberBySceneId = reservationMap(input.reservations);
  for (const sceneId of input.beforeSceneIds) {
    if (!numberBySceneId.has(sceneId)) {
      throw integrityError(`Current scene ${sceneId} has no production number reservation.`);
    }
  }

  if (input.reservations.length === 0 && input.beforeSceneIds.length === 0) {
    return input.afterSceneIds.map((sceneId, index) => ({
      productionNumber: String(index + 1),
      sceneId,
    }));
  }

  const allocations: SceneProductionNumberAllocation[] = [];
  let index = 0;
  while (index < input.afterSceneIds.length) {
    const sceneId = input.afterSceneIds[index]!;
    if (numberBySceneId.has(sceneId)) {
      index += 1;
      continue;
    }

    const runStart = index;
    while (
      index < input.afterSceneIds.length &&
      !numberBySceneId.has(input.afterSceneIds[index]!)
    ) {
      index += 1;
    }
    const runSceneIds = input.afterSceneIds.slice(runStart, index);
    const runAllocations = index === input.afterSceneIds.length
      ? allocateAppendedRun(runSceneIds, numberBySceneId)
      : allocateInsertedRun({
          sceneIds: runSceneIds,
          runStart,
          afterSceneIds: input.afterSceneIds,
          numberBySceneId,
        });
    for (const allocation of runAllocations) {
      allocations.push(allocation);
      numberBySceneId.set(allocation.sceneId, allocation.productionNumber);
    }
  }

  return allocations;
}

function allocateAppendedRun(
  sceneIds: string[],
  numberBySceneId: Map<string, string>
): SceneProductionNumberAllocation[] {
  let nextBase = highestNumericStem(numberBySceneId.values()) + 1n;
  return sceneIds.map((sceneId) => ({
    productionNumber: String(nextBase++),
    sceneId,
  }));
}

function allocateInsertedRun(input: {
  sceneIds: string[];
  runStart: number;
  afterSceneIds: string[];
  numberBySceneId: Map<string, string>;
}): SceneProductionNumberAllocation[] {
  if (input.runStart === 0) {
    return allocateAppendedRun(input.sceneIds, input.numberBySceneId);
  }

  const anchorSceneId = input.afterSceneIds[input.runStart - 1]!;
  const anchorNumber = input.numberBySceneId.get(anchorSceneId);
  const successorSceneId = input.afterSceneIds[input.runStart + input.sceneIds.length]!;
  const successorNumber = input.numberBySceneId.get(successorSceneId);
  if (!anchorNumber || !successorNumber) {
    throw integrityError('Inserted scene numbering could not resolve its neighboring production numbers.');
  }

  const anchor = splitProductionNumber(anchorNumber);
  const successor = splitProductionNumber(successorNumber);
  if (anchor.numericStem === successor.numericStem && successor.suffix) {
    throw unsupportedPlacementError(
      `A new scene cannot be numbered before existing inserted scene ${successorNumber}.`
    );
  }

  let suffixIndex = highestSuffixIndex(
    input.numberBySceneId.values(),
    anchor.numericStem
  );
  return input.sceneIds.map((sceneId) => {
    suffixIndex += 1n;
    return {
      productionNumber: `${anchor.numericStem}${suffixFromIndex(suffixIndex)}`,
      sceneId,
    };
  });
}

function reservationMap(
  reservations: SceneProductionNumberReservation[]
): Map<string, string> {
  const numberBySceneId = new Map<string, string>();
  const sceneIdByNumber = new Map<string, string>();
  for (const reservation of reservations) {
    const normalized = normalizeSceneProductionNumber(reservation.productionNumber);
    if (!normalized || normalized !== reservation.productionNumber) {
      throw integrityError(
        `Scene production number is not canonical: ${reservation.productionNumber}.`
      );
    }
    if (numberBySceneId.has(reservation.sceneId)) {
      throw integrityError(`Scene ${reservation.sceneId} has more than one production number.`);
    }
    if (sceneIdByNumber.has(normalized)) {
      throw integrityError(`Production scene number ${normalized} is reserved more than once.`);
    }
    numberBySceneId.set(reservation.sceneId, normalized);
    sceneIdByNumber.set(normalized, reservation.sceneId);
  }
  return numberBySceneId;
}

function highestNumericStem(numbers: Iterable<string>): bigint {
  let highest = 0n;
  for (const number of numbers) {
    const numericStem = BigInt(splitProductionNumber(number).numericStem);
    if (numericStem > highest) {
      highest = numericStem;
    }
  }
  return highest;
}

function highestSuffixIndex(numbers: Iterable<string>, numericStem: string): bigint {
  let highest = 0n;
  for (const number of numbers) {
    const parsed = splitProductionNumber(number);
    if (parsed.numericStem === numericStem && parsed.suffix) {
      const index = suffixIndex(parsed.suffix);
      if (index > highest) {
        highest = index;
      }
    }
  }
  return highest;
}

function splitProductionNumber(productionNumber: string): {
  numericStem: string;
  suffix: string;
} {
  const match = /^([1-9][0-9]*)([A-Z]*)$/.exec(productionNumber);
  if (!match) {
    throw integrityError(`Scene production number is not canonical: ${productionNumber}.`);
  }
  return { numericStem: match[1]!, suffix: match[2]! };
}

function suffixIndex(suffix: string): bigint {
  let value = 0n;
  for (const character of suffix) {
    value = value * 26n + BigInt(character.charCodeAt(0) - 64);
  }
  return value;
}

function suffixFromIndex(index: bigint): string {
  let remaining = index;
  let suffix = '';
  while (remaining > 0n) {
    remaining -= 1n;
    suffix = String.fromCharCode(65 + Number(remaining % 26n)) + suffix;
    remaining /= 26n;
  }
  return suffix;
}

function assertUniqueSceneIds(sceneIds: string[], context: string): void {
  if (new Set(sceneIds).size !== sceneIds.length) {
    throw integrityError(`The ${context} contains duplicate scene ids.`);
  }
}

function requireSceneId(sceneId: string | undefined): string {
  if (!sceneId) {
    throw integrityError('A resolved screenplay scene is missing its durable id.');
  }
  return sceneId;
}

function unsupportedPlacementError(message: string): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA449', message, {
    suggestion: 'Create the scene at a supported position and then move it, or place it after the last inserted scene in the gap.',
  });
}

function integrityError(message: string): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA450', message, {
    suggestion: 'Run project validation and repair production scene-number reservations through Core.',
  });
}
