import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { installSampleFilm, type SampleFilm } from '@gorenku/studio-core/server';
import { formatDiagnosticIssue, type RenkuCliIo } from '../cli.js';
import { appendProjectLibraryRefreshEvent } from './project-library-refresh.js';

export interface RunSampleFilmCommandOptions {
  input: string[];
  storageRoot?: string;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

const PROGRESS_STEP_PERCENT = 10;
const MEGABYTE = 1_000_000;

export async function runSampleFilmCommand(options: RunSampleFilmCommandOptions): Promise<number> {
  if (options.input.length !== 1 || options.input[0] !== 'install') {
    throw new StructuredError({
      code: 'CLI168',
      message: 'Unknown sample-film command.',
      issues: [
        createDiagnosticError(
          'CLI168',
          options.input.length === 0
            ? 'Missing sample-film subcommand.'
            : `Unsupported sample-film subcommand: ${options.input.join(' ')}`,
          { path: ['sample-film'], context: 'renku CLI arguments' }
        ),
      ],
      suggestion: 'Use `renku sample-film install`.',
    });
  }

  const report = await installSampleFilm({
    homeDir: options.homeDir,
    storageRoot: options.storageRoot,
    onProgress: options.json ? undefined : createProgressPrinter(options.io),
  });
  await appendProjectLibraryRefreshEvent({
    options,
    command: 'sample-film install',
    completedAction: 'The sample film is in the Project Library',
    projectName: report.projectName,
  });

  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
    return 0;
  }

  for (const warning of report.warnings) {
    options.io.stderr.error(formatDiagnosticIssue(warning));
  }
  options.io.stdout.log(
    report.outcome === 'installed'
      ? `Sample film installed: ${report.title}`
      : `Sample film already in the Project Library: ${report.title}`
  );
  options.io.stdout.log(`Project name: ${report.projectName}`);
  options.io.stdout.log(`Project: ${report.projectPath}`);
  if (report.version !== null) {
    options.io.stdout.log(`Sample version: ${report.version}`);
  }
  return 0;
}

function createProgressPrinter(io: RenkuCliIo): (sampleFilm: SampleFilm) => void {
  let printedPercent = -1;
  return ({ archiveBytes, installation }) => {
    if (installation.state === 'preparing') {
      io.stdout.log('Preparing the sample film…');
      return;
    }
    if (installation.state !== 'downloading') {
      return;
    }
    if (archiveBytes === null) {
      if (printedPercent === -1) {
        io.stdout.log('Downloading the sample film…');
        printedPercent = 0;
      }
      return;
    }
    const percent = Math.floor(installation.receivedBytes / archiveBytes * 100 / PROGRESS_STEP_PERCENT) *
      PROGRESS_STEP_PERCENT;
    if (percent > printedPercent) {
      printedPercent = percent;
      io.stdout.log(
        `Downloading the sample film: ${percent}% (${Math.round(installation.receivedBytes / MEGABYTE)} of ${Math.round(archiveBytes / MEGABYTE)} MB)`
      );
    }
  };
}
