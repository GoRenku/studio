import {
  allocateInitialProductionNumbers,
} from '../../client/production-numbers.js';
import type {
  Beat,
  BeatInput,
  BeatPlacement,
} from '../../client/scene-beats/index.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { allocateProductionNumberOrThrow } from '../production-number-allocation.js';

export function numberFreshBeats(input: {
  beats: BeatInput[];
  idGenerator: ProjectIdGenerator;
  reservedBeatIds?: string[];
}): { beats: Beat[]; reservedNumbers: string[] } {
  const ids = createBeatIdAllocator(input.idGenerator, input.reservedBeatIds ?? []);
  const numbers = allocateInitialProductionNumbers(input.beats.length);
  return {
    beats: input.beats.map((beat, index) => ({
      ...beat,
      id: ids(),
      number: numbers[index]!,
    })),
    reservedNumbers: numbers,
  };
}

export function numberInsertedBeats(input: {
  current: Beat[];
  reservedNumbers: string[];
  placement: BeatPlacement;
  beats: BeatInput[];
  idGenerator: ProjectIdGenerator;
  reservedBeatIds?: string[];
}): { inserted: Beat[]; index: number; reservedNumbers: string[] } {
  const ids = createBeatIdAllocator(input.idGenerator, input.reservedBeatIds ?? []);
  const ordered = [...input.current];
  const reservedNumbers = [...input.reservedNumbers];
  let index = placementIndex(ordered, input.placement);
  const inserted: Beat[] = [];
  for (const beat of input.beats) {
    const number = allocateProductionNumberOrThrow({
      orderedNumbers: ordered.map((candidate) => candidate.number),
      reservedNumbers,
      placement: index === ordered.length
        ? { position: 'end' }
        : { position: 'insert', index },
    });
    const numbered = { ...beat, id: ids(), number };
    ordered.splice(index, 0, numbered);
    inserted.push(numbered);
    reservedNumbers.push(number);
    index += 1;
  }
  return {
    inserted,
    index: index - inserted.length,
    reservedNumbers,
  };
}

function createBeatIdAllocator(
  idGenerator: ProjectIdGenerator,
  unavailableIds: string[]
): () => string {
  const unavailable = new Set(unavailableIds);
  return () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const id = idGenerator.next('beat');
      if (!unavailable.has(id)) {
        unavailable.add(id);
        return id;
      }
    }
    throw new ProjectDataError(
      'SCENE_BEAT_ID_ALLOCATION_FAILED',
      'Unable to allocate a unique Beat id.'
    );
  };
}

function placementIndex(beats: Beat[], placement: BeatPlacement): number {
  if (placement.position === 'start') {
    return 0;
  }
  if (placement.position === 'end') {
    return beats.length;
  }
  if (!('beatId' in placement)) {
    return beats.length;
  }
  const index = beats.findIndex((beat) => beat.id === placement.beatId);
  if (index < 0) {
    throw new ProjectDataError(
      'SCENE_BEATS_OPERATION_TARGET_NOT_FOUND',
      `Beat placement target was not found: ${placement.beatId}.`
    );
  }
  return placement.position === 'before' ? index : index + 1;
}
