import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectDataError } from '../../project-data-error.js';

const CORE_PACKAGE_NAME = '@gorenku/studio-core';
const DRIZZLE_JOURNAL_PATH = join('drizzle', 'meta', '_journal.json');
const USER_VERSION_PATTERN = /\bpragma\s+user_version\s*=\s*(\d+)\b/i;

interface DrizzleJournal {
  entries?: DrizzleJournalEntry[];
}

interface DrizzleJournalEntry {
  tag?: unknown;
}

let cachedProjectStoreSchemaGeneration: number | undefined;

export function currentProjectStoreSchemaGeneration(): number {
  cachedProjectStoreSchemaGeneration ??=
    readCurrentProjectStoreSchemaGeneration();
  return cachedProjectStoreSchemaGeneration;
}

function readCurrentProjectStoreSchemaGeneration(): number {
  const packageRoot = findCorePackageRoot(
    dirname(fileURLToPath(import.meta.url))
  );
  const journal = readDrizzleJournal(packageRoot);
  for (const entry of [...journal.entries].reverse()) {
    if (typeof entry.tag !== 'string' || entry.tag.length === 0) {
      continue;
    }
    const generation = readMigrationSchemaGeneration(packageRoot, entry.tag);
    if (generation !== null) {
      return generation;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA045',
    'Project database migrations do not define a project store schema generation.'
  );
}

function readDrizzleJournal(packageRoot: string): Required<DrizzleJournal> {
  const journalPath = join(packageRoot, DRIZZLE_JOURNAL_PATH);
  if (!existsSync(journalPath)) {
    throw new ProjectDataError(
      'PROJECT_DATA045',
      `Project database migration journal was not found at ${journalPath}.`
    );
  }
  const journal = JSON.parse(
    readFileSync(journalPath, 'utf8')
  ) as DrizzleJournal;
  if (!Array.isArray(journal.entries)) {
    throw new ProjectDataError(
      'PROJECT_DATA045',
      `Project database migration journal is missing entries: ${journalPath}.`
    );
  }
  return { entries: journal.entries };
}

function readMigrationSchemaGeneration(
  packageRoot: string,
  migrationTag: string
): number | null {
  const migrationPath = join(packageRoot, 'drizzle', `${migrationTag}.sql`);
  if (!existsSync(migrationPath)) {
    throw new ProjectDataError(
      'PROJECT_DATA045',
      `Project database migration was not found at ${migrationPath}.`
    );
  }
  const match = USER_VERSION_PATTERN.exec(readFileSync(migrationPath, 'utf8'));
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1]!, 10);
}

function findCorePackageRoot(startFolder: string): string {
  let currentFolder = startFolder;

  while (currentFolder !== dirname(currentFolder)) {
    const packageJsonPath = join(currentFolder, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, 'utf8')
      ) as { name?: string };

      if (packageJson.name === CORE_PACKAGE_NAME) {
        return currentFolder;
      }
    }

    currentFolder = dirname(currentFolder);
  }

  throw new ProjectDataError(
    'PROJECT_DATA045',
    `Could not resolve the ${CORE_PACKAGE_NAME} package root from ${startFolder}.`
  );
}
