import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  createStudioCoordinationService,
  createStudioOperationId,
  createProjectDataService,
  resolveRenkuStorageRoot,
  studioResourceKeysForAssetTarget,
  type Asset,
  type AssetTarget,
  type ProjectRelativePath,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

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
    projectRelativePath: requiredFlag(options, 'file') as ProjectRelativePath,
    fileRole: requiredFlag(options, 'fileRole'),
    role: requiredFlag(options, 'role'),
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendAssetResourceChangedEvent({
    options,
    projectName,
    resourceKeys,
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
  const asset = await createProjectDataService().createAssetSelect({
    projectName,
    target,
    assetId: requiredAssetId(assetId),
    selectionOrder: options.flags.order,
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendAssetResourceChangedEvent({
    options,
    projectName,
    resourceKeys,
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
  const asset = await createProjectDataService().updateAssetSelect({
    projectName,
    target,
    assetId: requiredAssetId(assetId),
    selectionOrder: requiredOrder(options),
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendAssetResourceChangedEvent({
    options,
    projectName,
    resourceKeys,
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
  const asset = await createProjectDataService().removeAssetSelect({
    projectName,
    target,
    assetId: requiredAssetId(assetId),
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendAssetResourceChangedEvent({
    options,
    projectName,
    resourceKeys,
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

async function appendAssetResourceChangedEvent(input: {
  options: RunAssetCommandOptions;
  projectName: string;
  resourceKeys: string[];
  command: string;
}): Promise<void> {
  if (input.resourceKeys.length === 0) {
    return;
  }

  try {
    const project = await createProjectDataService().readProjectShell({
      projectName: input.projectName,
      homeDir: input.options.homeDir,
    });
    const coordination = createStudioCoordinationService({
      homeDir: input.options.homeDir,
    });
    await coordination.appendStudioEvent({
      type: 'studio.projectResourcesChanged',
      projectRef: await toProjectRef(project, input.options.homeDir),
      resourceKeys: input.resourceKeys,
      source: { kind: 'cli', command: input.command },
      operationId: createStudioOperationId(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Studio coordination event could not be appended.';
    if (input.options.json) {
      input.options.io.stderr.error(
        JSON.stringify(
          {
            warnings: [
              {
                code: 'CLI043',
                message:
                  'Asset mutation succeeded, but Studio refresh coordination failed.',
                detail: message,
              },
            ],
          },
          null,
          2
        )
      );
      return;
    }
    input.options.io.stderr.error(
      `[CLI043] WARNING Asset mutation succeeded, but Studio refresh coordination failed: ${message}`
    );
  }
}

async function toProjectRef(
  project: { identity: { name: string; id: string } },
  homeDir?: string
): Promise<StudioProjectRef> {
  return {
    name: project.identity.name,
    id: project.identity.id,
    storageRoot: await resolveRenkuStorageRoot({ homeDir }),
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
    case 'visual-language':
      return { kind: 'visualLanguage', visualLanguageId: id };
    case 'cast':
      return { kind: 'castMember', castMemberId: id };
    case 'continuity-reference':
      return { kind: 'continuityReference', continuityReferenceId: id };
    case 'sequence':
      return { kind: 'sequence', sequenceId: id };
    case 'scene':
      return { kind: 'scene', sceneId: id };
    case 'clip':
      return { kind: 'clip', clipId: id };
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
        'Use project, visual-language:<id>, cast:<id>, sequence:<id>, scene:<id>, or clip:<id>.'
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
    case 'visualLanguage':
      return `visual-language:${target.visualLanguageId}`;
    case 'castMember':
      return `cast:${target.castMemberId}`;
    case 'continuityReference':
      return `continuity-reference:${target.continuityReferenceId}`;
    case 'sequence':
      return `sequence:${target.sequenceId}`;
    case 'scene':
      return `scene:${target.sceneId}`;
    case 'clip':
      return `clip:${target.clipId}`;
  }
}
