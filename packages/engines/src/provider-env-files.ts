import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROVIDER_ENV_FILE_NAME = '.env' as const;
const RENKU_CONFIG_DIR_NAME = 'renku' as const;

export interface LoadProviderEnvFilesOptions {
  renkuConfigDir?: string;
  homeDir?: string;
  override?: boolean;
}

export interface LoadProviderEnvFilesResult {
  loaded: string[];
  skipped: string[];
}

export function loadProviderEnvFiles(
  options: LoadProviderEnvFilesOptions = {}
): LoadProviderEnvFilesResult {
  const protectedKeys = options.override
    ? new Set<string>()
    : new Set(Object.keys(process.env));
  const loaded: string[] = [];
  const skipped: string[] = [];

  const filePath = resolveProviderEnvFilePath(options);
  if (!existsSync(filePath)) {
    return { loaded, skipped };
  }

  const contents = readOptionalProviderEnvFile(filePath);
  if (contents === null) {
    skipped.push(filePath);
    return { loaded, skipped };
  }

  applyProviderEnvFile(contents, {
    protectedKeys,
  });
  loaded.push(filePath);

  return { loaded, skipped };
}

function readOptionalProviderEnvFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    if (isFileAccessDeniedError(error)) {
      return null;
    }
    throw error;
  }
}

function isFileAccessDeniedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'EACCES' || error.code === 'EPERM')
  );
}

function resolveProviderEnvFilePath(
  options: LoadProviderEnvFilesOptions
): string {
  return path.join(
    options.renkuConfigDir ??
      path.join(options.homeDir ?? os.homedir(), '.config', RENKU_CONFIG_DIR_NAME),
    PROVIDER_ENV_FILE_NAME
  );
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
