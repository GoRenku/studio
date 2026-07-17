import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO_E2E_SERVER_URL } from '../../server/studio-dev-server';

export interface StudioE2eRuntime {
  packageRoot: string;
  workspaceRoot: string;
  runId: string;
  runRoot: string;
  isolatedHomeDirectory: string;
  projectStorageRoot: string;
  serverUrl: string;
  keepArtifacts: boolean;
}

export function prepareStudioE2eRuntime(input: {
  packageRoot: string;
}): StudioE2eRuntime {
  const workspaceRoot = path.resolve(input.packageRoot, '..', '..');
  const runId =
    process.env.RENKU_STUDIO_E2E_RUN_ID ??
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const runRoot =
    process.env.RENKU_STUDIO_E2E_RUN_ROOT ??
    path.join(workspaceRoot, 'tmp', 'studio-e2e', runId);
  const isolatedHomeDirectory =
    process.env.RENKU_STUDIO_E2E_ISOLATED_HOME_DIR ?? path.join(runRoot, 'home');
  const projectStorageRoot =
    process.env.RENKU_STUDIO_E2E_PROJECT_STORAGE_ROOT ??
    path.join(isolatedHomeDirectory, 'projects');
  const runtime: StudioE2eRuntime = {
    packageRoot: input.packageRoot,
    workspaceRoot,
    runId,
    runRoot,
    isolatedHomeDirectory,
    projectStorageRoot,
    serverUrl: STUDIO_E2E_SERVER_URL,
    keepArtifacts: process.env.RENKU_STUDIO_E2E_KEEP_ARTIFACTS === '1',
  };

  fs.mkdirSync(path.join(isolatedHomeDirectory, '.config', 'renku'), { recursive: true });
  fs.mkdirSync(projectStorageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(isolatedHomeDirectory, '.config', 'renku', 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${projectStorageRoot}\n`,
    'utf8'
  );

  process.env.RENKU_STUDIO_E2E_RUN_ID = runtime.runId;
  process.env.RENKU_STUDIO_E2E_RUN_ROOT = runtime.runRoot;
  process.env.RENKU_STUDIO_E2E_ISOLATED_HOME_DIR = runtime.isolatedHomeDirectory;
  process.env.RENKU_STUDIO_E2E_PROJECT_STORAGE_ROOT = runtime.projectStorageRoot;

  return runtime;
}

export function readStudioE2eRuntime(): StudioE2eRuntime {
  const packageRoot = path.resolve(studioE2eRuntimeModuleDir(), '..', '..');
  const workspaceRoot = path.resolve(packageRoot, '..', '..');
  const runRoot = requiredEnv('RENKU_STUDIO_E2E_RUN_ROOT');
  const isolatedHomeDirectory = requiredEnv('RENKU_STUDIO_E2E_ISOLATED_HOME_DIR');
  const projectStorageRoot = requiredEnv('RENKU_STUDIO_E2E_PROJECT_STORAGE_ROOT');
  return {
    packageRoot,
    workspaceRoot,
    runId: requiredEnv('RENKU_STUDIO_E2E_RUN_ID'),
    runRoot,
    isolatedHomeDirectory,
    projectStorageRoot,
    serverUrl: STUDIO_E2E_SERVER_URL,
    keepArtifacts: process.env.RENKU_STUDIO_E2E_KEEP_ARTIFACTS === '1',
  };
}

export function assertInsideStudioE2eRoot(
  runtime: Pick<StudioE2eRuntime, 'runRoot'>,
  targetPath: string
): void {
  const relative = path.relative(runtime.runRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new Error(`Refusing to clean path outside Studio E2E root: ${targetPath}`);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required Studio E2E environment variable: ${name}`);
  }
  return value;
}

function studioE2eRuntimeModuleDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}
