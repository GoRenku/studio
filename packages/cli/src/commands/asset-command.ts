import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type AssetPage,
  type AssetOwner,
  type AssetSelectionReport,
  type AssetSelectionTarget,
  type AssetUpdateReport,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import {
  appendStudioResourceChangedEvent,
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
  owner?: string;
  target?: string;
  asset?: string;
  type?: string;
  mediaKind?: string;
  title?: string;
  summary?: string;
  referenceName?: string;
  tag?: string[];
  clearTags?: boolean;
  locale?: string;
}

export async function runAssetCommand(
  options: RunAssetCommandOptions
): Promise<number> {
  const [subcommand, assetId] = options.input;
  switch (subcommand) {
    case 'update':
      return updateAsset(options, assetId);
    case 'list':
      return listAssets(options);
    case 'select':
      return selectAsset(options);
    case 'clear-selection':
      return clearAssetSelection(options);
    default:
      throw new StructuredError({
        code: 'CLI040',
        message:
          'Unknown asset command. Usage: renku asset update|list|select|clear-selection ...',
        issues: [
          createDiagnosticError(
            'CLI040',
            'Unknown asset command.',
            { path: ['asset'], context: 'renku CLI arguments' },
            'Use renku asset update, list, select, or clear-selection.'
          ),
        ],
      });
  }
}

async function updateAsset(
  options: RunAssetCommandOptions,
  assetId?: string
): Promise<number> {
  const projectData = createProjectDataService();
  assertTagFlags(options.flags);
  const report = await projectData.updateAsset({
    projectName: requiredFlag(options, 'project'),
    assetId: requiredAssetId(assetId),
    title: options.flags.title,
    oneLineSummary: options.flags.summary,
    referenceName: options.flags.referenceName,
    ...(options.flags.clearTags
      ? { tags: [] }
      : options.flags.tag !== undefined
        ? { tags: options.flags.tag }
        : {}),
    localeId: options.flags.locale,
    homeDir: options.homeDir,
  });
  await notify(options, projectData, report, 'asset update');
  writeAssetMutation(
    options,
    report,
    `Updated Asset: ${report.asset.id}`
  );
  return 0;
}

function assertTagFlags(flags: AssetCommandFlags): void {
  if (!flags.clearTags || flags.tag === undefined) {
    return;
  }
  throw new StructuredError({
    code: 'CLI045',
    message: 'Asset update accepts either --tag or --clear-tags, not both.',
    issues: [
      createDiagnosticError(
        'CLI045',
        'Asset update tag flags are mutually exclusive.',
        { path: ['--tag', '--clear-tags'], context: 'renku CLI arguments' },
        'Remove --tag or --clear-tags.'
      ),
    ],
  });
}

async function listAssets(options: RunAssetCommandOptions): Promise<number> {
  const page = await createProjectDataService().listAssetPage({
    projectName: requiredFlag(options, 'project'),
    owner: parseAssetOwner(requiredFlag(options, 'owner')),
    locale: readLocale(options),
    type: optionalTrimmed(options.flags.type),
    mediaKind: optionalTrimmed(options.flags.mediaKind),
    homeDir: options.homeDir,
  });
  writeAssetList(options, page);
  return 0;
}

async function selectAsset(options: RunAssetCommandOptions): Promise<number> {
  const projectData = createProjectDataService();
  const report = await projectData.selectAsset({
    projectName: requiredFlag(options, 'project'),
    target: parseSelectionTarget(requiredFlag(options, 'target')),
    assetId: requiredFlag(options, 'asset'),
    homeDir: options.homeDir,
  });
  await notify(options, projectData, report, 'asset select');
  writeSelectionMutation(options, report, 'Selected Asset');
  return 0;
}

async function clearAssetSelection(
  options: RunAssetCommandOptions
): Promise<number> {
  const projectData = createProjectDataService();
  const report = await projectData.clearAssetSelection({
    projectName: requiredFlag(options, 'project'),
    target: parseSelectionTarget(requiredFlag(options, 'target')),
    homeDir: options.homeDir,
  });
  await notify(options, projectData, report, 'asset clear-selection');
  writeSelectionMutation(options, report, 'Cleared selected Asset');
  return 0;
}

async function notify(
  options: RunAssetCommandOptions,
  projectDataService: ReturnType<typeof createProjectDataService>,
  report: AssetUpdateReport | AssetSelectionReport,
  command: string
): Promise<void> {
  await appendStudioResourceChangedEvent({
    runtime: {
      homeDir: options.homeDir,
      json: options.json,
      io: options.io,
      projectDataService,
    },
    report,
    command,
  });
}

function writeAssetMutation(
  options: RunAssetCommandOptions,
  report: AssetUpdateReport,
  message: string
): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
    return;
  }
  options.io.stdout.log(message);
  options.io.stdout.log(`Owner: ${formatOwner(report.asset.owner)}`);
}

function writeSelectionMutation(
  options: RunAssetCommandOptions,
  report: AssetSelectionReport,
  message: string
): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
    return;
  }
  options.io.stdout.log(
    report.selectedAssetId
      ? `${message}: ${report.selectedAssetId}`
      : message
  );
}

function writeAssetList(options: RunAssetCommandOptions, page: AssetPage): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify(page, null, 2));
    return;
  }
  if (page.items.length === 0) {
    options.io.stdout.log('No Assets found.');
    return;
  }
  for (const asset of page.items) {
    options.io.stdout.log(
      `${asset.id} ${asset.type}${asset.id === page.selectedAssetId ? ' (selected)' : ''}`
    );
  }
}

export function parseAssetOwner(value: string): AssetOwner {
  if (value === 'project') {
    return { kind: 'project' };
  }
  const parts = value.split(':');
  if (parts[0] === 'beat' && parts.length === 3 && parts[1] && parts[2]) {
    return { kind: 'sceneBeat', sceneId: parts[1], beatId: parts[2] };
  }
  if (parts.length !== 2 || !parts[1]) {
    throw invalidOwner(value);
  }
  switch (parts[0]) {
    case 'cast':
      return { kind: 'castMember', id: parts[1] };
    case 'location':
      return { kind: 'location', id: parts[1] };
    case 'prop':
      return { kind: 'prop', id: parts[1] };
    case 'scene':
      return { kind: 'scene', id: parts[1] };
    case 'lookbook':
      return { kind: 'lookbook', id: parts[1] };
    case 'shot':
      return { kind: 'shot', id: parts[1] };
    default:
      throw invalidOwner(value);
  }
}

export function parseSelectionTarget(value: string): AssetSelectionTarget {
  if (value.startsWith('location-world:')) {
    const id = value.slice('location-world:'.length);
    if (id) {
      return { kind: 'locationWorld', id };
    }
  }
  const owner = parseAssetOwner(value);
  if (
    owner.kind === 'project'
    || owner.kind === 'castMember'
    || owner.kind === 'location'
    || owner.kind === 'prop'
    || owner.kind === 'lookbook'
    || owner.kind === 'shot'
    || owner.kind === 'sceneBeat'
  ) {
    return owner;
  }
  throw new StructuredError({
    code: 'CLI046',
    message: `Invalid Asset selection target: ${value}.`,
    issues: [
      createDiagnosticError(
        'CLI046',
        'Asset selection supports the Project, Cast Members, Locations, Location Worlds, Props, Lookbooks, Shots, and Scene Beats.',
        { path: ['--target'], context: 'renku CLI arguments' },
        'Use project, cast:<id>, location:<id>, location-world:<id>, prop:<id>, lookbook:<id>, shot:<id>, or beat:<scene-id>:<beat-id>.'
      ),
    ],
  });
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
    message: 'Missing required Asset id.',
    issues: [
      createDiagnosticError(
        'CLI042',
        'Asset update requires an Asset id.',
        { path: ['asset'], context: 'renku CLI arguments' },
        'Pass the Asset id as the final positional argument.'
      ),
    ],
  });
}

function invalidOwner(owner: string): StructuredError {
  return new StructuredError({
    code: 'CLI044',
    message: `Invalid Asset owner: ${owner}.`,
    issues: [
      createDiagnosticError(
        'CLI044',
        'Asset owner has an unsupported form.',
        { path: ['--owner'], context: 'renku CLI arguments' },
        'Use project, cast:<id>, location:<id>, sequence:<id>, scene:<id>, lookbook:<id>, shot:<id>, or beat:<scene-id>:<beat-id>.'
      ),
    ],
  });
}

function flagName(name: keyof AssetCommandFlags): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function formatOwner(owner: AssetOwner): string {
  if (owner.kind === 'project') {
    return 'project';
  }
  if (owner.kind === 'sceneBeat') {
    return `beat:${owner.sceneId}:${owner.beatId}`;
  }
  return `${owner.kind}:${owner.id}`;
}
