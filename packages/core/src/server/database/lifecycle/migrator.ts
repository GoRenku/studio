import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectDataError } from '../../project-data-error.js';

const CORE_PACKAGE_NAME = '@gorenku/studio-core';
const PROJECT_DATABASE_PATH_ENV = 'RENKU_PROJECT_DATABASE_PATH';

export function migrateProjectDatabase(databasePath: string): void {
  const packageRoot = findCorePackageRoot(dirname(fileURLToPath(import.meta.url)));
  const configPath = join(packageRoot, 'drizzle.project-migrate.config.ts');
  const drizzleKitPath = join(packageRoot, 'node_modules', 'drizzle-kit', 'bin.cjs');

  if (!existsSync(configPath)) {
    throw new ProjectDataError(
      'PROJECT_DATA040',
      `Project database migration config was not found at ${configPath}.`
    );
  }
  if (!existsSync(drizzleKitPath)) {
    throw new ProjectDataError(
      'PROJECT_DATA040',
      `Drizzle Kit executable was not found at ${drizzleKitPath}.`
    );
  }

  const result = spawnSync(
    process.execPath,
    [drizzleKitPath, 'migrate', '--config', configPath],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        [PROJECT_DATABASE_PATH_ENV]: databasePath,
      },
    }
  );

  if (result.error) {
    throw new ProjectDataError(
      'PROJECT_DATA041',
      `Project database migration command failed to start for ${databasePath}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter((value) => value.trim().length > 0)
      .join('\n');

    throw new ProjectDataError(
      'PROJECT_DATA042',
      `Project database migration failed for ${databasePath}.${output ? `\n${output}` : ''}`
    );
  }
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
    'PROJECT_DATA043',
    `Could not resolve the ${CORE_PACKAGE_NAME} package root from ${startFolder}.`
  );
}
