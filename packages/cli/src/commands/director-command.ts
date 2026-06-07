import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  createStudioCoordinationService,
  type DirectorContextReport,
  type StudioSelection,
} from '@gorenku/studio-core/server';
import { formatDiagnosticIssue, type RenkuCliIo } from '../cli.js';

export interface RunDirectorCommandOptions {
  input: string[];
  flags: DirectorCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export interface DirectorCommandFlags {
  selection?: string;
}

export async function runDirectorCommand(
  options: RunDirectorCommandOptions
): Promise<number> {
  const [subcommand] = options.input;
  if (subcommand !== 'context') {
    throw new StructuredError({
      code: 'CLI020',
      message: 'Unknown director command. Usage: renku director context --json',
      issues: [
        createDiagnosticError(
          'CLI020',
          'Unknown director command.',
          { path: ['director'], context: 'renku CLI arguments' },
          'Run renku director context --json.'
        ),
      ],
    });
  }

  const selection = options.flags.selection
    ? parseSelectionFlag(options.flags.selection)
    : undefined;
  const studioCurrent = selection
    ? undefined
    : await createStudioCoordinationService({
        homeDir: options.homeDir,
      }).readStudioCurrent();
  const report = await createProjectDataService().readDirectorContext({
    homeDir: options.homeDir,
    ...(selection ? { selection } : {}),
    ...(studioCurrent ? { studioCurrent } : {}),
  });

  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
  } else {
    writeDirectorContextSummary(options.io, report);
  }
  return 0;
}

function parseSelectionFlag(value: string): StudioSelection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new StructuredError({
      code: 'CLI030',
      message: 'Director selection must be valid JSON.',
      issues: [
        createDiagnosticError(
          'CLI030',
          'Could not parse --selection as JSON.',
          { path: ['--selection'], context: 'renku CLI arguments' },
          'Pass a Studio selection object such as {"type":"scene","id":"scene_..."}'
        ),
      ],
    });
  }

  if (!isStudioSelectionCandidate(parsed)) {
    throw new StructuredError({
      code: 'CLI031',
      message: 'Director selection must be a Studio selection object.',
      issues: [
        createDiagnosticError(
          'CLI031',
          'The --selection JSON does not look like a Studio selection.',
          { path: ['--selection'], context: 'renku CLI arguments' },
          'Pass a JSON object with a supported type field.'
        ),
      ],
    });
  }
  return parsed;
}

function isStudioSelectionCandidate(value: unknown): value is StudioSelection {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return (
    type === 'projectInformation' ||
    type === 'inspiration' ||
    type === 'lookbooks' ||
    type === 'lookbook' ||
    type === 'cast' ||
    type === 'castMember' ||
    type === 'locations' ||
    type === 'location' ||
    type === 'storyArc' ||
    type === 'act' ||
    type === 'sequence' ||
    type === 'scene'
  );
}

function writeDirectorContextSummary(
  io: RenkuCliIo,
  report: DirectorContextReport
): void {
  io.stdout.log(`Director context: ${report.project.title}`);
  io.stdout.log(`Project: ${report.project.name} (${report.project.aspectRatio})`);
  io.stdout.log(
    `Screenplay: ${report.screenplay.exists ? 'present' : 'missing'}; active analysis: ${
      report.screenplay.activeAnalysisId ?? 'none'
    }`
  );
  io.stdout.log(
    `Visual language: ${report.visualLanguage.lookbookCount} lookbook(s); active: ${
      report.visualLanguage.activeLookbookId ?? 'none'
    }`
  );
  if (report.selectedScene) {
    io.stdout.log(
      `Selected scene: ${report.selectedScene.sceneId}; active shot list: ${
        report.selectedScene.activeShotListId ?? 'none'
      }`
    );
  }
  if (report.nextSteps.length > 0) {
    io.stdout.log('Next steps:');
    for (const step of report.nextSteps) {
      io.stdout.log(`- ${step.title} (${step.specialistSkill}): ${step.reason}`);
    }
  } else {
    io.stdout.log('Next steps: none. The current director context has no obvious blocker.');
  }
  if (report.diagnostics.length > 0) {
    io.stdout.log('Diagnostics:');
    for (const diagnostic of report.diagnostics) {
      io.stdout.log(`- ${formatDiagnosticIssue(diagnostic)}`);
    }
  }
}
