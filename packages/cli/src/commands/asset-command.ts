import {
  StructuredError,
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  studioResourceKeysForAssetTarget,
  type Asset,
  type AssetTarget,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';

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
}

export async function runAssetCommand(
  options: RunAssetCommandOptions
): Promise<number> {
  const [subcommand, assetId] = options.input;
  if (subcommand === 'reference-update') {
    return await updateAssetReference(options, assetId);
  }
  if (subcommand === 'list') {
    return await listAssets(options);
  }
  throw new StructuredError({
    code: 'CLI040',
    message:
      'Unknown asset command. Usage: renku asset reference-update|list ...',
    issues: [
      createDiagnosticError(
        'CLI040',
        'Unknown asset command.',
        { path: ['asset'], context: 'renku CLI arguments' },
        'Use renku asset reference-update or list.'
      ),
    ],
  });
}

async function updateAssetReference(
  options: RunAssetCommandOptions,
  assetId?: string
): Promise<number> {
  const projectName = requiredFlag(options, 'project');
  const target = readTarget(options);
  const referenceName = requiredFlag(options, 'referenceName');
  const referencePurpose = optionalTrimmed(options.flags.referencePurpose);
  const projectData = createProjectDataService();
  const eventProject = await readAssetEventProject(
    projectData,
    projectName,
    options.homeDir
  );
  const asset = await projectData.updateAssetReference({
    projectName,
    target,
    assetId: requiredAssetId(assetId),
    title: options.flags.title,
    oneLineSummary: options.flags.summary,
    referenceName,
    purpose: referencePurpose,
    homeDir: options.homeDir,
  });
  const resourceKeys = studioResourceKeysForAssetTarget(target);
  await appendStudioResourceChangedEvent({
    runtime: cliRuntime(options, projectData),
    report: { project: eventProject, resourceKeys },
    command: 'asset reference-update',
  });
  const warnings: DiagnosticIssue[] = [];
  if (!referencePurpose) {
    warnings.push(
      createDiagnosticWarning(
        'CLI045',
        'Missing optional --reference-purpose for asset reference update.',
        { path: ['--reference-purpose'], context: 'renku CLI arguments' },
        'Pass --reference-purpose when the asset has a known production use, or omit it to leave the purpose empty.'
      )
    );
  }
  writeAssetResult(
    options,
    asset,
    `Updated asset reference: ${asset.assetId}`,
    resourceKeys,
    warnings
  );
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

function writeAssetResult(
  options: RunAssetCommandOptions,
  asset: Asset,
  message: string,
  resourceKeys: string[] = [],
  warnings: DiagnosticIssue[] = []
): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify({ asset, resourceKeys, warnings }, null, 2));
    return;
  }
  for (const warning of warnings) {
    options.io.stderr.error(warning.message);
  }
  options.io.stdout.log(message);
  options.io.stdout.log(`Attached to: ${formatTarget(asset.target)}`);
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
      `${asset.assetId} ${asset.type} ${asset.role}`
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

async function readAssetEventProject(
  projectDataService: ReturnType<typeof createProjectDataService>,
  projectName: string,
  homeDir?: string
): Promise<StudioResourceChangedReport['project']> {
  const project = await projectDataService.readProjectShell({ projectName, homeDir });
  return {
    name: project.identity.name,
    id: project.identity.id,
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

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
        'Asset commands that mutate a record require an asset id.',
        { path: ['asset'], context: 'renku CLI arguments' },
        'Pass the asset id as the final positional argument.'
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
