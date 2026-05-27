import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROVIDER_ENV_FILE_NAMES = ['.env', '.env.local'] as const;
const RENKU_CONFIG_DIR_NAME = 'renku' as const;
const STUDIO_ENGINES_PACKAGE_NAME = '@gorenku/studio-engines' as const;

export interface LoadProviderEnvFilesOptions {
  providerEnvRoots?: string[];
  studioWorkspaceRoot?: string;
  renkuConfigDir?: string;
  homeDir?: string;
  override?: boolean;
}

export interface LoadProviderEnvFilesResult {
  loaded: string[];
}

export function loadProviderEnvFiles(
  options: LoadProviderEnvFilesOptions = {}
): LoadProviderEnvFilesResult {
  const protectedKeys = options.override
    ? new Set<string>()
    : new Set(Object.keys(process.env));
  const loaded: string[] = [];

  for (const directory of resolveProviderEnvRoots(options)) {
    for (const fileName of PROVIDER_ENV_FILE_NAMES) {
      const filePath = path.join(directory, fileName);
      if (!existsSync(filePath)) {
        continue;
      }
      applyProviderEnvFile(readFileSync(filePath, 'utf8'), {
        protectedKeys,
      });
      loaded.push(filePath);
    }
  }

  return { loaded };
}

function resolveProviderEnvRoots(
  options: LoadProviderEnvFilesOptions
): string[] {
  if (options.providerEnvRoots) {
    return uniqueResolvedPaths(options.providerEnvRoots);
  }

  const roots: string[] = [
    options.renkuConfigDir ??
      path.join(options.homeDir ?? os.homedir(), '.config', RENKU_CONFIG_DIR_NAME),
  ];
  const workspaceRoot =
    options.studioWorkspaceRoot ?? findStudioWorkspaceRoot(import.meta.url);
  if (workspaceRoot) {
    roots.push(workspaceRoot);
  }

  return uniqueResolvedPaths(roots);
}

function findStudioWorkspaceRoot(moduleUrl: string): string | null {
  const packageRoot = findEnginePackageRoot(
    path.dirname(fileURLToPath(moduleUrl))
  );
  if (!packageRoot) {
    return null;
  }

  const packagesDir = path.dirname(packageRoot);
  if (
    path.basename(packageRoot) !== 'engines' ||
    path.basename(packagesDir) !== 'packages'
  ) {
    return packageRoot;
  }

  return path.dirname(packagesDir);
}

function findEnginePackageRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    const packageJsonPath = path.join(current, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
          name?: unknown;
        };
        if (packageJson.name === STUDIO_ENGINES_PACKAGE_NAME) {
          return current;
        }
      } catch {
        return null;
      }
    }
    current = path.dirname(current);
  }
  return null;
}

function uniqueResolvedPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const currentPath of paths) {
    const normalized = path.resolve(currentPath);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    resolved.push(normalized);
  }
  return resolved;
}

function applyProviderEnvFile(
  contents: string,
  options: { protectedKeys: Set<string> }
): void {
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseProviderEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (options.protectedKeys.has(parsed.key)) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
  }
}

function parseProviderEnvLine(
  line: string
): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return {
    key,
    value: stripOptionalQuotes(trimmed.slice(separatorIndex + 1).trim()),
  };
}

function stripOptionalQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
