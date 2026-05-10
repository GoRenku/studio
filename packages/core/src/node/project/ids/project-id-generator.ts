import { randomBytes } from 'node:crypto';

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ID_LENGTH = 8;

export type EntityIdPrefix =
  | 'project'
  | 'locale'
  | 'visual_language'
  | 'cast'
  | 'episode'
  | 'sequence'
  | 'scene'
  | 'clip'
  | 'asset'
  | 'asset_file'
  | 'project_asset'
  | 'visual_language_asset'
  | 'cast_asset'
  | 'sequence_asset'
  | 'scene_asset'
  | 'clip_asset';

export interface ProjectIdGenerator {
  next(prefix: EntityIdPrefix): string;
}

export function createRandomIdGenerator(): ProjectIdGenerator {
  return {
    next(prefix) {
      return `${prefix}_${randomIdSuffix()}`;
    },
  };
}

export function createDeterministicIdGenerator(): ProjectIdGenerator {
  const counts = new Map<EntityIdPrefix, number>();
  return {
    next(prefix) {
      const nextCount = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, nextCount);
      return `${prefix}_test${String(nextCount).padStart(4, '0')}`;
    },
  };
}

export function createUniqueIdAllocator(
  generator: ProjectIdGenerator
): (prefix: EntityIdPrefix) => string {
  const allocated = new Set<string>();
  return (prefix) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const id = generator.next(prefix);
      if (!allocated.has(id)) {
        allocated.add(id);
        return id;
      }
    }
    throw new Error(`Unable to allocate unique ${prefix} id.`);
  };
}

function randomIdSuffix(): string {
  const bytes = randomBytes(ID_LENGTH);
  let suffix = '';
  for (const byte of bytes) {
    suffix += ID_ALPHABET[byte % ID_ALPHABET.length];
  }
  return suffix;
}
