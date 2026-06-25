import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface StudioE2eRuntime {
  packageRoot: string;
  workspaceRoot: string;
  runId: string;
  runRoot: string;
  homeDir: string;
  storageRoot: string;
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
    process.env.RENKU_STUDIO_E2E_ROOT ??
    path.join(workspaceRoot, 'tmp', 'studio-e2e', runId);
  const homeDir =
    process.env.RENKU_STUDIO_E2E_HOME ?? path.join(runRoot, 'home');
  const storageRoot =
    process.env.RENKU_STUDIO_E2E_STORAGE_ROOT ??
    path.join(homeDir, 'projects');
  const runtime: StudioE2eRuntime = {
    packageRoot: input.packageRoot,
    workspaceRoot,
    runId,
    runRoot,
    homeDir,
    storageRoot,
    serverUrl: 'http://localhost:5173',
    keepArtifacts: process.env.RENKU_STUDIO_E2E_KEEP_ARTIFACTS === '1',
  };

  fs.mkdirSync(path.join(homeDir, '.config', 'renku'), { recursive: true });
  fs.mkdirSync(storageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, '.config', 'renku', 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );

  process.env.RENKU_STUDIO_E2E_RUN_ID = runtime.runId;
  process.env.RENKU_STUDIO_E2E_ROOT = runtime.runRoot;
  process.env.RENKU_STUDIO_E2E_HOME = runtime.homeDir;
  process.env.RENKU_STUDIO_E2E_STORAGE_ROOT = runtime.storageRoot;

  return runtime;
}

export function readStudioE2eRuntime(): StudioE2eRuntime {
  const packageRoot = path.resolve(studioE2eRuntimeModuleDir(), '..', '..');
  const workspaceRoot = path.resolve(packageRoot, '..', '..');
  const runRoot = requiredEnv('RENKU_STUDIO_E2E_ROOT');
  const homeDir = requiredEnv('RENKU_STUDIO_E2E_HOME');
  const storageRoot = requiredEnv('RENKU_STUDIO_E2E_STORAGE_ROOT');
  return {
    packageRoot,
    workspaceRoot,
    runId: requiredEnv('RENKU_STUDIO_E2E_RUN_ID'),
    runRoot,
    homeDir,
    storageRoot,
    serverUrl: 'http://localhost:5173',
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
