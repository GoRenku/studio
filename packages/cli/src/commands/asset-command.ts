import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  studioResourceKeysForAssetTarget,
  type Asset,
  type AssetTarget,
  type ProjectRelativePath,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export interface RunAssetCommandOptions {
  input: string[];
  flags: AssetCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export interface AssetCommandFlags {
  project?: string;
  target?: string;
  type?: string;
  mediaKind?: string;
  role?: string;
  fileRole?: string;
  file?: string;
  title?: string;
  summary?: string;
  referenceName?: string;
  referencePurpose?: string;
  locale?: string;
  order?: number;
}

export async function runAssetCommand(
  options: RunAssetCommandOptions
): Promise<number> {
  const [subcommand, assetId] = options.input;
  if (subcommand === 'register') {
    return await registerAsset(options);
  }
  if (subcommand === 'list') {
    return await listAssets(options);
  }
  if (subcommand === 'select') {
    return await createAssetSelect(options, assetId);
  }
  if (subcommand === 'select-update') {
    return await updateAssetSelect(options, assetId);
  }
  if (subcommand === 'select-remove') {
    return await removeAssetSelect(options, assetId);
  }
  if (subcommand === 'selects') {
    return await listAssetSelects(options);
  }

  throw new StructuredError({
    code: 'CLI040',
    message:
      'Unknown asset command. Usage: renku asset register|list|select|select-update|select-remove|selects ...',
    issues: [
      createDiagnosticError(
        'CLI040',
        'Unknown asset command.',
        { path: ['asset'], context: 'renku CLI arguments' },
        'Use renku asset register, list, select, select-update, select-remove, or selects.'
      ),
    ],
  });
}

async function registerAsset(options: RunAssetCommandOptions): Promise<number> {
  const projectName = requiredFlag(options, 'project');
  const target = readTarget(options);
  const projectData = createProjectDataService();
  const asset = await projectData.registerAsset({
    projectName,
    target,
    locale: readLocale(options),
    type: requiredFlag(options, 'type'),
    mediaKind: requiredFlag(options, 'mediaKind'),
    title: requiredFlag(options, 'title'),
    oneLineSummary: options.flags.summary,
    referenceName: options.flags.referenceName,
    purpose: options.flags.referencePurpose,
    projectRelativePath: requiredFlag(options, 'file') as ProjectRelativePath,
    fileRole: requiredFlag(options, 'fileRole'),
    role: requiredFlag(options, 'role'),
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendStudioResourceChangedEvent({
    runtime: cliRuntime(options, projectData),
    report: { project: { name: projectName }, resourceKeys },
    command: 'asset register',
  });
  writeAssetResult(options, asset, `Registered asset: ${asset.assetId}`, resourceKeys);
  return 0;
}

async function listAssets(options: RunAssetCommandOptions): Promise<number> {
  const assets = await createProjectDataService().listAssets({
    projectName: requiredFlag(options, 'project'),
    target: readTarget(options),
    locale: readLocale(options),
    homeDir: options.homeDir,
  });
  writeAssetList(options, assets);
  return 0;
}

async function createAssetSelect(
  options: RunAssetCommandOptions,
  assetId?: string
): Promise<number> {
  const projectName = requiredFlag(options, 'project');
  const target = readTarget(options);
  const projectData = createProjectDataService();
  const asset = await projectData.createAssetSelect({
    projectName,
    target,
    assetId: requiredAssetId(assetId),
    selectionOrder: options.flags.order,
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendStudioResourceChangedEvent({
    runtime: cliRuntime(options, projectData),
    report: { project: { name: projectName }, resourceKeys },
    command: 'asset select',
  });
  writeAssetResult(options, asset, `Selected asset: ${asset.assetId}`, resourceKeys);
  return 0;
}

async function updateAssetSelect(
  options: RunAssetCommandOptions,
  assetId?: string
): Promise<number> {
  const projectName = requiredFlag(options, 'project');
  const target = readTarget(options);
  const projectData = createProjectDataService();
  const asset = await projectData.updateAssetSelect({
    projectName,
    target,
    assetId: requiredAssetId(assetId),
    selectionOrder: requiredOrder(options),
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendStudioResourceChangedEvent({
    runtime: cliRuntime(options, projectData),
    report: { project: { name: projectName }, resourceKeys },
    command: 'asset select-update',
  });
  writeAssetResult(
    options,
    asset,
    `Updated selected asset: ${asset.assetId}`,
    resourceKeys
  );
  return 0;
}

async function removeAssetSelect(
  options: RunAssetCommandOptions,
  assetId?: string
): Promise<number> {
  const projectName = requiredFlag(options, 'project');
  const target = readTarget(options);
  const projectData = createProjectDataService();
  const asset = await projectData.removeAssetSelect({
    projectName,
    target,
    assetId: requiredAssetId(assetId),
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendStudioResourceChangedEvent({
    runtime: cliRuntime(options, projectData),
    report: { project: { name: projectName }, resourceKeys },
    command: 'asset select-remove',
  });
  writeAssetResult(
    options,
    asset,
    `Changed asset back to take: ${asset.assetId}`,
    resourceKeys
  );
  return 0;
}

async function listAssetSelects(options: RunAssetCommandOptions): Promise<number> {
  const assets = await createProjectDataService().listAssetSelects({
    projectName: requiredFlag(options, 'project'),
    target: readTarget(options),
    locale: readLocale(options),
    homeDir: options.homeDir,
  });
  writeAssetList(options, assets);
  return 0;
}

function writeAssetResult(
  options: RunAssetCommandOptions,
  asset: Asset,
  message: string,
  resourceKeys: string[] = []
): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify({ asset, resourceKeys }, null, 2));
    return;
  }
  options.io.stdout.log(message);
  options.io.stdout.log(`Attached to: ${formatTarget(asset.target)}`);
  options.io.stdout.log(`Selection: ${asset.selection.kind}`);
  if (resourceKeys.length > 0) {
    options.io.stdout.log(`Refresh resources: ${resourceKeys.join(', ')}`);
  }
}

function writeAssetList(options: RunAssetCommandOptions, assets: Asset[]): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify({ assets }, null, 2));
    return;
  }
  if (assets.length === 0) {
    options.io.stdout.log('No assets found.');
    return;
  }
  for (const asset of assets) {
    options.io.stdout.log(
      `${asset.assetId} ${asset.type} ${asset.role} ${asset.selection.kind}`
    );
  }
}

function cliRuntime(
  options: RunAssetCommandOptions,
  projectDataService: ReturnType<typeof createProjectDataService>
) {
  return {
    homeDir: options.homeDir,
    json: options.json,
    io: options.io,
    projectDataService,
  };
}

function readTarget(options: RunAssetCommandOptions): AssetTarget {
  const target = requiredFlag(options, 'target');
  if (target === 'project') {
    return { kind: 'project' };
  }
  const separatorIndex = target.indexOf(':');
  if (separatorIndex < 1 || separatorIndex === target.length - 1) {
    throw invalidTarget(target);
  }
  const kind = target.slice(0, separatorIndex);
  const id = target.slice(separatorIndex + 1);
  switch (kind) {
    case 'cast':
      return { kind: 'castMember', castMemberId: id };
    case 'location':
      return { kind: 'location', locationId: id };
    case 'sequence':
      return { kind: 'sequence', sequenceId: id };
    case 'scene':
      return { kind: 'scene', sceneId: id };
    default:
      throw invalidTarget(target);
  }
}

function readLocale(options: RunAssetCommandOptions): { localeId?: string } {
  return options.flags.locale ? { localeId: options.flags.locale } : {};
}

function requiredFlag(
  options: RunAssetCommandOptions,
  name: keyof AssetCommandFlags
): string {
  const value = options.flags[name];
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  throw new StructuredError({
    code: 'CLI041',
    message: `Missing required --${flagName(name)} option.`,
    issues: [
      createDiagnosticError(
        'CLI041',
        `Missing required --${flagName(name)} option.`,
        { path: [`--${flagName(name)}`], context: 'renku CLI arguments' },
        `Pass --${flagName(name)}.`
      ),
    ],
  });
}

function requiredAssetId(assetId?: string): string {
  if (assetId?.trim()) {
    return assetId;
  }
  throw new StructuredError({
    code: 'CLI042',
    message: 'Missing required asset id.',
    issues: [
      createDiagnosticError(
        'CLI042',
        'Asset selection commands require an asset id.',
        { path: ['asset'], context: 'renku CLI arguments' },
        'Pass the asset id as the final positional argument.'
      ),
    ],
  });
}

function requiredOrder(options: RunAssetCommandOptions): number {
  if (options.flags.order !== undefined) {
    return options.flags.order;
  }
  throw new StructuredError({
    code: 'CLI043',
    message: 'Missing required --order option.',
    issues: [
      createDiagnosticError(
        'CLI043',
        'select-update requires --order.',
        { path: ['--order'], context: 'renku CLI arguments' },
        'Pass --order <number>.'
      ),
    ],
  });
}

function invalidTarget(target: string): StructuredError {
  return new StructuredError({
    code: 'CLI044',
    message: `Invalid asset target: ${target}.`,
    issues: [
      createDiagnosticError(
        'CLI044',
        'Asset target must be project or kind:id.',
        { path: ['--target'], context: 'renku CLI arguments' },
        'Use project, cast:<id>, location:<id>, sequence:<id>, or scene:<id>.'
      ),
    ],
  });
}

function flagName(name: keyof AssetCommandFlags): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function formatTarget(target: AssetTarget): string {
  switch (target.kind) {
    case 'project':
      return 'project';
    case 'castMember':
      return `cast:${target.castMemberId}`;
    case 'location':
      return `location:${target.locationId}`;
    case 'sequence':
      return `sequence:${target.sequenceId}`;
    case 'scene':
      return `scene:${target.sceneId}`;
  }
}
