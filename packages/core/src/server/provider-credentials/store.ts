import fs from 'node:fs/promises';
import path from 'node:path';
import {
  findProviderCredentialDescriptor,
  listProviderCredentialDescriptors,
  type ProviderCredentialId,
} from '@gorenku/studio-engines';
import {
  resolveRenkuConfigDir,
  type RenkuConfigPathOptions,
} from '../config/index.js';

const PROVIDER_ENV_FILE_NAME = '.env' as const;

export interface ProviderCredentialStoreOptions extends RenkuConfigPathOptions {}

export interface ProviderCredentialStoreEntry {
  provider: ProviderCredentialId;
  configured: boolean;
}

export interface ProviderCredentialStoreState {
  providers: ProviderCredentialStoreEntry[];
}

export interface ProviderCredentialWrite {
  provider: string;
  value: string;
}

export class ProviderCredentialStoreError extends Error {
  readonly operation: 'read' | 'write';

  constructor(operation: 'read' | 'write', message: string) {
    super(message);
    this.name = 'ProviderCredentialStoreError';
    this.operation = operation;
  }
}

export function resolveProviderCredentialFilePath(
  options: ProviderCredentialStoreOptions = {}
): string {
  return path.join(resolveRenkuConfigDir(options), PROVIDER_ENV_FILE_NAME);
}

export async function readProviderCredentialStore(
  options: ProviderCredentialStoreOptions = {}
): Promise<ProviderCredentialStoreState> {
  const document = await readProviderEnvironmentDocument(options);
  return {
    providers: listProviderCredentialDescriptors().map((descriptor) => ({
      provider: descriptor.provider,
      configured: Boolean(
        usableValue(document.assignments.get(descriptor.environmentVariable))
      ),
    })),
  };
}

export async function writeProviderCredentials(
  changes: readonly ProviderCredentialWrite[],
  options: ProviderCredentialStoreOptions = {}
): Promise<ProviderCredentialStoreState> {
  const document = await readProviderEnvironmentDocument(options);
  const managedValues = new Map<string, string>();
  for (const descriptor of listProviderCredentialDescriptors()) {
    const value = usableValue(
      document.assignments.get(descriptor.environmentVariable)
    );
    if (value) {
      managedValues.set(descriptor.environmentVariable, value);
    }
  }

  for (const change of changes) {
    const descriptor = findProviderCredentialDescriptor(change.provider);
    if (!descriptor) {
      throw new ProviderCredentialStoreError(
        'write',
        'Provider credential update contains an unsupported provider.'
      );
    }
    managedValues.set(descriptor.environmentVariable, change.value);
  }

  const managedKeys = new Set(
    listProviderCredentialDescriptors().map(
      (descriptor) => descriptor.environmentVariable
    )
  );
  const preservedLines = document.lines.filter((line) => {
    const assignment = parseProviderEnvironmentLine(line);
    return !assignment || !managedKeys.has(assignment.key);
  });
  const lines = [...preservedLines];
  for (const descriptor of listProviderCredentialDescriptors()) {
    const value = managedValues.get(descriptor.environmentVariable);
    if (value !== undefined) {
      lines.push(`${descriptor.environmentVariable}=${JSON.stringify(value)}`);
    }
  }

  await replaceProviderEnvironmentFile(
    resolveProviderCredentialFilePath(options),
    lines.length > 0 ? `${lines.join('\n')}\n` : ''
  );
  return readProviderCredentialStore(options);
}

export async function readSavedProviderCredential(
  key: string,
  options: ProviderCredentialStoreOptions = {}
): Promise<string | null> {
  const document = await readProviderEnvironmentDocument(options);
  return usableValue(document.assignments.get(key));
}

interface ProviderEnvironmentDocument {
  assignments: Map<string, string>;
  lines: string[];
}

async function readProviderEnvironmentDocument(
  options: ProviderCredentialStoreOptions
): Promise<ProviderEnvironmentDocument> {
  const filePath = resolveProviderCredentialFilePath(options);
  let contents: string;
  try {
    const stats = await fs.lstat(filePath);
    if (!stats.isFile()) {
      throw new ProviderCredentialStoreError(
        'read',
        'The Renku provider credential path is not a regular file.'
      );
    }
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { assignments: new Map(), lines: [] };
    }
    if (error instanceof ProviderCredentialStoreError) {
      throw error;
    }
    throw new ProviderCredentialStoreError(
      'read',
      'The Renku provider credential file could not be read.'
    );
  }

  const lines = contents.split(/\r?\n/);
  if (/\r?\n$/.test(contents)) {
    lines.pop();
  }
  const assignments = new Map<string, string>();
  for (const line of lines) {
    const assignment = parseProviderEnvironmentLine(line);
    if (assignment) {
      assignments.set(assignment.key, assignment.value);
    }
  }
  return { assignments, lines };
}

async function replaceProviderEnvironmentFile(
  filePath: string,
  contents: string
): Promise<void> {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.env.${process.pid}.${Date.now()}.tmp`
  );
  let temporaryCreated = false;
  try {
    await fs.mkdir(directory, { recursive: true });
    const handle = await fs.open(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(contents, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporaryPath, filePath);
    temporaryCreated = false;
  } catch {
    if (temporaryCreated) {
      await fs.unlink(temporaryPath).catch(() => undefined);
    }
    throw new ProviderCredentialStoreError(
      'write',
      'The Renku provider credential file could not be updated.'
    );
  }
}

function parseProviderEnvironmentLine(
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
    value: parseProviderEnvironmentValue(
      trimmed.slice(separatorIndex + 1).trim()
    ),
  };
}

function parseProviderEnvironmentValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'string' ? parsed : value.slice(1, -1);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

function usableValue(value: string | undefined): string | null {
  return value?.trim() ? value : null;
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && 'code' in error;
}
