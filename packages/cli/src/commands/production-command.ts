import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type ProductionExportSummary,
  type ProductionExportVariant,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export interface RunProductionCommandOptions {
  input: string[];
  flags: ProductionCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export interface ProductionCommandFlags {
  project?: string;
  locale?: string;
  allLocales?: boolean;
  dryRun?: boolean;
  fresh?: boolean;
}

export async function runProductionCommand(
  options: RunProductionCommandOptions
): Promise<number> {
  const [subcommand] = options.input;
  if (subcommand === 'export') {
    return await exportProductionAssets(options);
  }

  throw new StructuredError({
    code: 'CLI060',
    message: 'Unknown production command. Usage: renku production export ...',
    issues: [
      createDiagnosticError(
        'CLI060',
        'Unknown production command.',
        { path: ['production'], context: 'renku CLI arguments' },
        'Use renku production export.'
      ),
    ],
  });
}

async function exportProductionAssets(
  options: RunProductionCommandOptions
): Promise<number> {
  const summary = await createProjectDataService().exportProductionAssets({
    projectName: requiredProject(options),
    variants: readVariants(options),
    dryRun: options.flags.dryRun,
    fresh: options.flags.fresh,
    homeDir: options.homeDir,
  });
  writeSummary(options, summary);
  return 0;
}

function readVariants(
  options: RunProductionCommandOptions
): ProductionExportVariant[] | undefined {
  if (options.flags.locale && options.flags.allLocales) {
    throw new StructuredError({
      code: 'CLI061',
      message: 'Use either --locale or --all-locales, not both.',
      issues: [
        createDiagnosticError(
          'CLI061',
          'Conflicting production export locale options.',
          { path: ['--locale'], context: 'renku CLI arguments' },
          'Choose one locale filter, or omit both options to export master and all locales with selected production assets.'
        ),
      ],
    });
  }

  if (options.flags.locale) {
    return [
      { kind: 'master' },
      { kind: 'localized', localeId: options.flags.locale },
    ];
  }

  return undefined;
}

function writeSummary(
  options: RunProductionCommandOptions,
  summary: ProductionExportSummary
): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify(summary, null, 2));
    return;
  }

  options.io.stdout.log('Production export complete.');
  options.io.stdout.log(`Copied: ${summary.copiedFileCount}`);
  options.io.stdout.log(`Skipped: ${summary.skippedFileCount}`);
  options.io.stdout.log(`Pruned: ${summary.prunedFileCount}`);
  options.io.stdout.log(`Unmanaged: ${summary.unmanagedFileCount}`);
}

function requiredProject(options: RunProductionCommandOptions): string {
  const projectName = options.flags.project?.trim();
  if (projectName) {
    return projectName;
  }
  throw new StructuredError({
    code: 'CLI062',
    message: 'Missing required --project option.',
    issues: [
      createDiagnosticError(
        'CLI062',
        'Production export requires a project name.',
        { path: ['--project'], context: 'renku CLI arguments' },
        'Pass --project <project-name>.'
      ),
    ],
  });
}
