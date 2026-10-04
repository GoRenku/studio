import type { RunAssetFileCommandOptions, AssetFileCommandFlags } from './types.js';
import { parseAssetFileOwner, parseSelectionTarget, requiredFlag, requiredAssetFileId, readLocale, optionalTrimmed } from './parsing.js';
import { writeAssetFileMutation, writeAssetFileList, writeSelectionMutation } from './formatting.js';
import { importReferenceFiles } from './reference-import.js';
import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type AssetFileSelectionReport,
  type AssetFileUpdateReport,
} from '@gorenku/studio-core/server';
import {
  appendStudioResourceChangedEvent,
} from '../studio-resource-event-command.js';

export async function runAssetFileCommand(
  options: RunAssetFileCommandOptions
): Promise<number> {
  const [subcommand, assetFileId] = options.input;
  switch (subcommand) {
    case 'import':
      return importReferenceFiles(options);
    case 'update':
      return updateAssetFile(options, assetFileId);
    case 'list':
      return listAssetFiles(options);
    case 'select':
      return selectAssetFile(options);
    case 'clear-selection':
      return clearAssetFileSelection(options);
    default:
      throw new StructuredError({
        code: 'CLI040',
        message:
          'Unknown asset command. Usage: renku asset import|update|list|select|clear-selection ...',
        issues: [
          createDiagnosticError(
            'CLI040',
            'Unknown asset command.',
            { path: ['asset'], context: 'renku CLI arguments' },
            'Use renku asset import, update, list, select, or clear-selection.'
          ),
        ],
      });
  }
}

async function updateAssetFile(
  options: RunAssetFileCommandOptions,
  assetFileId?: string
): Promise<number> {
  const projectData = createProjectDataService();
  assertTagFlags(options.flags);
  const report = await projectData.updateAssetFile({
    projectName: requiredFlag(options, 'project'),
    assetFileId: requiredAssetFileId(assetFileId),
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
  writeAssetFileMutation(
    options,
    report,
    `Updated Asset: ${report.assetFile.id}`
  );
  return 0;
}

function assertTagFlags(flags: AssetFileCommandFlags): void {
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

async function listAssetFiles(options: RunAssetFileCommandOptions): Promise<number> {
  const page = await createProjectDataService().listAssetFilePage({
    projectName: requiredFlag(options, 'project'),
    owner: parseAssetFileOwner(requiredFlag(options, 'owner')),
    locale: readLocale(options),
    type: optionalTrimmed(options.flags.type),
    mediaKind: optionalTrimmed(options.flags.mediaKind),
    limit: options.flags.limit,
    cursor: optionalTrimmed(options.flags.cursor),
    homeDir: options.homeDir,
  });
  writeAssetFileList(options, page);
  return 0;
}

async function selectAssetFile(options: RunAssetFileCommandOptions): Promise<number> {
  const projectData = createProjectDataService();
  const report = await projectData.selectAssetFile({
    projectName: requiredFlag(options, 'project'),
    target: parseSelectionTarget(requiredFlag(options, 'target')),
    assetFileId: requiredFlag(options, 'assetFile'),
    homeDir: options.homeDir,
  });
  await notify(options, projectData, report, 'asset select');
  writeSelectionMutation(options, report, 'Selected Asset');
  return 0;
}

async function clearAssetFileSelection(
  options: RunAssetFileCommandOptions
): Promise<number> {
  const projectData = createProjectDataService();
  const report = await projectData.clearAssetFileSelection({
    projectName: requiredFlag(options, 'project'),
    target: parseSelectionTarget(requiredFlag(options, 'target')),
    homeDir: options.homeDir,
  });
  await notify(options, projectData, report, 'asset clear-selection');
  writeSelectionMutation(options, report, 'Cleared selected Asset');
  return 0;
}

async function notify(
  options: RunAssetFileCommandOptions,
  projectDataService: ReturnType<typeof createProjectDataService>,
  report: AssetFileUpdateReport | AssetFileSelectionReport,
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

