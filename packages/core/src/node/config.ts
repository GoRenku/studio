import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const RENKU_CONFIG_VERSION = '0.1.0' as const;
export const RENKU_CONFIG_DIR_NAME = 'renku' as const;
export const RENKU_CONFIG_FILE_NAME = 'config.yaml' as const;

export interface RenkuConfig {
  version: typeof RENKU_CONFIG_VERSION;
  storageRoot: string;
}

export interface RenkuConfigPathOptions {
  homeDir?: string;
}

export interface ReadRenkuConfigOptions extends RenkuConfigPathOptions {
  configPath?: string;
}

export interface InitRenkuConfigOptions extends RenkuConfigPathOptions {
  configPath?: string;
}

export interface InitRenkuConfigResult {
  status: 'created' | 'existing';
  config: RenkuConfig;
  configDir: string;
  configPath: string;
  storageRoot: string;
}

export class RenkuConfigError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'RenkuConfigError';
  }
}

export function resolveRenkuConfigDir(
  options: RenkuConfigPathOptions = {}
): string {
  return path.join(options.homeDir ?? os.homedir(), '.config', RENKU_CONFIG_DIR_NAME);
}

export function resolveRenkuConfigPath(
  options: RenkuConfigPathOptions = {}
): string {
  return path.join(resolveRenkuConfigDir(options), RENKU_CONFIG_FILE_NAME);
}

export async function readRenkuConfig(
  options: ReadRenkuConfigOptions = {}
): Promise<RenkuConfig> {
  const configPath = options.configPath ?? resolveRenkuConfigPath(options);
  const contents = await readConfigFile(configPath);
  const parsed = parseConfigYaml(contents, configPath);
  return validateRenkuConfig(parsed, configPath);
}

export async function resolveRenkuStorageRoot(
  options: ReadRenkuConfigOptions = {}
): Promise<string> {
  const config = await readRenkuConfig(options);
  return config.storageRoot;
}

export async function initRenkuConfig(
  storageRootInput: string,
  options: InitRenkuConfigOptions = {}
): Promise<InitRenkuConfigResult> {
  if (!storageRootInput.trim()) {
    throw new RenkuConfigError(
      'C001',
      'storageRoot is required. Run `renku init <storage-root>` with an explicit path.'
    );
  }

  const configPath = options.configPath ?? resolveRenkuConfigPath(options);
  const configDir = path.dirname(configPath);

  if (await fileExists(configPath)) {
    const config = await readRenkuConfig({ ...options, configPath });
    return {
      status: 'existing',
      config,
      configDir,
      configPath,
      storageRoot: config.storageRoot,
    };
  }

  await ensureDirectory(configDir, 'config directory');

  const storageRoot = path.resolve(storageRootInput);
  await ensureDirectory(storageRoot, 'storageRoot');

  const config: RenkuConfig = {
    version: RENKU_CONFIG_VERSION,
    storageRoot,
  };

  await fs.writeFile(configPath, stringifyYaml(config), 'utf8');

  return {
    status: 'created',
    config,
    configDir,
    configPath,
    storageRoot,
  };
}

async function readConfigFile(configPath: string): Promise<string> {
  try {
    return await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new RenkuConfigError(
        'C002',
        `Renku config not found at ${configPath}. Run \`renku init <storage-root>\` first.`
      );
    }
    throw error;
  }
}

function parseConfigYaml(contents: string, configPath: string): unknown {
  try {
    return parseYaml(contents);
  } catch (error) {
    throw new RenkuConfigError(
      'C003',
      `Invalid YAML in Renku config at ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function validateRenkuConfig(value: unknown, configPath: string): RenkuConfig {
  if (!isPlainObject(value)) {
    throw new RenkuConfigError(
      'C004',
      `Renku config at ${configPath} must be a YAML object.`
    );
  }

  for (const key of Object.keys(value)) {
    if (!isCamelCaseKey(key)) {
      throw new RenkuConfigError(
        'C005',
        `Renku config key "${key}" must use camelCase.`
      );
    }
  }

  if (value.version !== RENKU_CONFIG_VERSION) {
    throw new RenkuConfigError(
      'C006',
      `Renku config version must be "${RENKU_CONFIG_VERSION}".`
    );
  }

  if (typeof value.storageRoot !== 'string' || !value.storageRoot.trim()) {
    throw new RenkuConfigError(
      'C007',
      'Renku config must define storageRoot as a non-empty string.'
    );
  }

  return {
    version: RENKU_CONFIG_VERSION,
    storageRoot: path.resolve(value.storageRoot),
  };
}

async function ensureDirectory(directoryPath: string, label: string): Promise<void> {
  try {
    const stats = await fs.stat(directoryPath);
    if (!stats.isDirectory()) {
      throw new RenkuConfigError(
        'C008',
        `Cannot create Renku ${label}: ${directoryPath} already exists and is not a directory.`
      );
    }
    return;
  } catch (error) {
    if (error instanceof RenkuConfigError) {
      throw error;
    }
    if (isNodeError(error) && error.code === 'ENOENT') {
      await fs.mkdir(directoryPath, { recursive: true });
      return;
    }
    throw error;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new RenkuConfigError(
        'C009',
        `Renku config path exists but is not a file: ${filePath}.`
      );
    }
    return true;
  } catch (error) {
    if (error instanceof RenkuConfigError) {
      throw error;
    }
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCamelCaseKey(key: string): boolean {
  return /^[a-z][A-Za-z0-9]*$/.test(key);
}

function isNodeError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && 'code' in error;
}
