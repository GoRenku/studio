import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  StructuredError,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const RENKU_CONFIG_VERSION = '0.1.0' as const;
export const RENKU_CONFIG_DIR_NAME = 'renku' as const;
export const RENKU_CONFIG_FILE_NAME = 'config.yaml' as const;

export interface RenkuConfig {
  version: typeof RENKU_CONFIG_VERSION;
  storageRoot: string;
  agentMedia?: {
    imageGeneration?: {
      defaultExecutionPath?: ImageGenerationExecutionPath;
    };
  };
}

export interface RenkuConfigPathOptions {
  homeDir?: string;
  storageRoot?: string;
}

export type ImageGenerationExecutionPath =
  | 'codexBuiltInWhenAvailable'
  | 'renkuManaged'
  | 'ask';

export interface AgentMediaExecutionPolicy {
  imageGeneration: {
    defaultExecutionPath: ImageGenerationExecutionPath;
  };
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

export class RenkuConfigError extends StructuredError {
  constructor(
    code: string,
    message: string,
    options: {
      issues?: DiagnosticIssue[];
      suggestion?: string;
    } = {}
  ) {
    super({
      code,
      message,
      issues: options.issues,
      suggestion: options.suggestion,
    });
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
  if (options.storageRoot?.trim()) {
    return path.resolve(options.storageRoot);
  }
  const config = await readRenkuConfig(options);
  return config.storageRoot;
}

export async function readAgentMediaExecutionPolicy(
  options: ReadRenkuConfigOptions = {}
): Promise<AgentMediaExecutionPolicy> {
  const config = await readRenkuConfig(options);
  return agentMediaExecutionPolicyFromConfig(config);
}

export function agentMediaExecutionPolicyFromConfig(
  config: RenkuConfig
): AgentMediaExecutionPolicy {
  return {
    imageGeneration: {
      defaultExecutionPath:
        config.agentMedia?.imageGeneration?.defaultExecutionPath ?? 'ask',
    },
  };
}

export async function initRenkuConfig(
  storageRootInput: string,
  options: InitRenkuConfigOptions = {}
): Promise<InitRenkuConfigResult> {
  if (!storageRootInput.trim()) {
    throw new RenkuConfigError(
      'CONFIG001',
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
        'CONFIG002',
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
      'CONFIG003',
      `Invalid YAML in Renku config at ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function validateRenkuConfig(value: unknown, configPath: string): RenkuConfig {
  if (!isPlainObject(value)) {
    throw new RenkuConfigError(
      'CONFIG004',
      `Renku config at ${configPath} must be a YAML object.`
    );
  }

  for (const key of Object.keys(value)) {
    if (!isCamelCaseKey(key)) {
      throw new RenkuConfigError(
        'CONFIG005',
        `Renku config key "${key}" must use camelCase.`
      );
    }
  }

  assertAllowedKeys(value, ['version', 'storageRoot', 'agentMedia'], [], configPath);

  if (value.version !== RENKU_CONFIG_VERSION) {
    throw new RenkuConfigError(
      'CONFIG006',
      `Renku config version must be "${RENKU_CONFIG_VERSION}".`
    );
  }

  if (typeof value.storageRoot !== 'string' || !value.storageRoot.trim()) {
    throw new RenkuConfigError(
      'CONFIG007',
      'Renku config must define storageRoot as a non-empty string.'
    );
  }

  const agentMedia = validateAgentMediaConfig(value.agentMedia, configPath);

  return {
    version: RENKU_CONFIG_VERSION,
    storageRoot: path.resolve(value.storageRoot),
    ...(agentMedia ? { agentMedia } : {}),
  };
}

function validateAgentMediaConfig(
  value: unknown,
  configPath: string
): RenkuConfig['agentMedia'] {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new RenkuConfigError(
      'CONFIG010',
      `Renku config agentMedia at ${configPath} must be a YAML object.`
    );
  }
  assertCamelCaseKeys(value);
  assertAllowedKeys(value, ['imageGeneration'], ['agentMedia'], configPath);
  const imageGeneration = validateAgentImageGenerationConfig(
    value.imageGeneration,
    configPath
  );
  return {
    ...(imageGeneration ? { imageGeneration } : {}),
  };
}

function validateAgentImageGenerationConfig(
  value: unknown,
  configPath: string
): NonNullable<RenkuConfig['agentMedia']>['imageGeneration'] {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new RenkuConfigError(
      'CONFIG011',
      `Renku config agentMedia.imageGeneration at ${configPath} must be a YAML object.`
    );
  }
  assertCamelCaseKeys(value);
  assertAllowedKeys(
    value,
    ['defaultExecutionPath'],
    ['agentMedia', 'imageGeneration'],
    configPath
  );
  if (
    value.defaultExecutionPath !== undefined &&
    !isImageGenerationExecutionPath(value.defaultExecutionPath)
  ) {
    throw new RenkuConfigError(
      'CONFIG012',
      'Renku config agentMedia.imageGeneration.defaultExecutionPath has an unsupported value.',
      {
        issues: [
          createDiagnosticError(
            'CONFIG012',
            'agentMedia.imageGeneration.defaultExecutionPath must be codexBuiltInWhenAvailable, renkuManaged, or ask.',
            {
              path: ['agentMedia', 'imageGeneration', 'defaultExecutionPath'],
              context: 'Renku config',
            },
            'Use defaultExecutionPath: ask unless this Renku setup has a known image execution policy.'
          ),
        ],
        suggestion:
          'Use codexBuiltInWhenAvailable, renkuManaged, or ask.',
      }
    );
  }
  return {
    ...(value.defaultExecutionPath
      ? { defaultExecutionPath: value.defaultExecutionPath }
      : {}),
  };
}

function assertCamelCaseKeys(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (!isCamelCaseKey(key)) {
      throw new RenkuConfigError(
        'CONFIG005',
        `Renku config key "${key}" must use camelCase.`
      );
    }
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  pathSegments: readonly string[],
  configPath: string
): void {
  const allowed = new Set(allowedKeys);
  const unknownKey = Object.keys(value).find((key) => !allowed.has(key));
  if (!unknownKey) {
    return;
  }
  const fullPath = [...pathSegments, unknownKey].join('.');
  throw new RenkuConfigError(
    'CONFIG013',
    `Unknown Renku config key "${fullPath}" at ${configPath}.`,
    {
      issues: [
        createDiagnosticError(
          'CONFIG013',
          `Unknown Renku config key "${fullPath}".`,
          { path: [...pathSegments, unknownKey], context: 'Renku config' },
          'Remove the unknown key or update Renku to a version that supports it.'
        ),
      ],
      suggestion: 'Remove unknown Renku config keys before running Studio commands.',
    }
  );
}

function isImageGenerationExecutionPath(
  value: unknown
): value is ImageGenerationExecutionPath {
  return (
    value === 'codexBuiltInWhenAvailable' ||
    value === 'renkuManaged' ||
    value === 'ask'
  );
}

async function ensureDirectory(directoryPath: string, label: string): Promise<void> {
  try {
    const stats = await fs.stat(directoryPath);
    if (!stats.isDirectory()) {
      throw new RenkuConfigError(
        'CONFIG008',
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
        'CONFIG009',
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
