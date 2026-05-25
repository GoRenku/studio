import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROVIDER_ENV_FILE_NAMES = ['.env', '.env.local'] as const;

export interface LoadProviderEnvFilesOptions {
  startDir?: string;
  stopDir?: string;
  override?: boolean;
}

export interface LoadProviderEnvFilesResult {
  loaded: string[];
}

export function loadProviderEnvFiles(
  options: LoadProviderEnvFilesOptions = {}
): LoadProviderEnvFilesResult {
  const startDir = path.resolve(options.startDir ?? process.cwd());
  const stopDir = path.resolve(options.stopDir ?? os.homedir());
  const protectedKeys = options.override
    ? new Set<string>()
    : new Set(Object.keys(process.env));
  const loaded: string[] = [];

  for (const directory of candidateEnvDirectories(startDir, stopDir)) {
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

function candidateEnvDirectories(startDir: string, stopDir: string): string[] {
  const directories: string[] = [];
  let current = startDir;

  while (current !== path.dirname(current)) {
    directories.push(current);
    if (current === stopDir) {
      break;
    }
    current = path.dirname(current);
  }

  return directories.reverse();
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
