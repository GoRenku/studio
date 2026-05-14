#!/usr/bin/env node
import {
  createDiagnosticError,
  isStructuredError,
  StructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import meow from 'meow';
import { runAboutCommand } from './commands/about-command.js';
import { runAssetCommand } from './commands/asset-command.js';
import { runCreateCommand } from './commands/create-project-command.js';
import { runInitCommand } from './commands/initialize-config-command.js';
import { runProjectInformationCommand } from './commands/project-information-command.js';
import { runProjectSelectionCommand } from './commands/project-selection-command.js';
import { runProductionCommand } from './commands/production-command.js';
import { runStudioCurrentCommand } from './commands/studio-current-command.js';

export interface RenkuCliIo {
  stdout: Pick<typeof console, 'log'>;
  stderr: Pick<typeof console, 'error'>;
}

export interface RunRenkuCliOptions {
  io?: RenkuCliIo;
  homeDir?: string;
}

const defaultIo: RenkuCliIo = {
  stdout: {
    log: (message: string) => {
      process.stdout.write(`${message}\n`);
    },
  },
  stderr: {
    error: (message: string) => {
      process.stderr.write(`${message}\n`);
    },
  },
};

const helpText = `
Usage
  $ renku <command>

Commands
  create --file <yaml>            Create a project from setup YAML
  init <storage-root>  Create or inspect the global Renku config
  about                Show Renku CLI package information
  asset                Register, list, and select assets
  production export    Export selected production assets
  info show            Show project information
  info set             Update project information
  info clear           Clear optional project information fields
  info language        Add, update, remove, or set base languages
  project current      Show the current Studio project
  project select       Request Studio to select a project
  project migrate      Apply pending project database migrations
  studio current       Show current Studio focus and context

Options
  --file               Project create YAML file
  --storage-root       Override configured storage root for this command
  --project            Project name for project information commands
  --target             Asset attachment target
  --type               Asset type
  --media-kind         Asset media kind
  --role               Asset relationship role
  --file-role          Asset file role
  --order              Selection order
  --locale             Project locale id
  --all-locales        Export every locale with production selects
  --dry-run            Report production export operations without writing
  --fresh              Rebuild production export manifest
  --title              Project title
  --aspect-ratio       Project aspect ratio
  --logline            Project logline
  --summary            Project summary
  --display-name       Language display name
  --base               Mark language as base
  --audio, --no-audio  Toggle language audio support
  --subtitles, --no-subtitles
  --json               Print machine-readable JSON
  --help, -h           Show help
  --version            Show version

Examples
  $ renku create --file sample-project.yaml
  $ renku init ~/Movies/renku
  $ renku init /Volumes/Media/Renku --json
`;

function createCliFlags() {
  return {
    json: {
      type: 'boolean',
      default: false,
    },
    file: {
      type: 'string',
    },
    storageRoot: {
      type: 'string',
    },
    project: {
      type: 'string',
    },
    title: {
      type: 'string',
    },
    target: {
      type: 'string',
    },
    type: {
      type: 'string',
    },
    mediaKind: {
      type: 'string',
    },
    role: {
      type: 'string',
    },
    fileRole: {
      type: 'string',
    },
    order: {
      type: 'number',
    },
    locale: {
      type: 'string',
    },
    allLocales: {
      type: 'boolean',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      default: false,
    },
    fresh: {
      type: 'boolean',
      default: false,
    },
    aspectRatio: {
      type: 'string',
    },
    logline: {
      type: 'string',
    },
    summary: {
      type: 'string',
    },
    displayName: {
      type: 'string',
    },
    base: {
      type: 'boolean',
    },
    audio: {
      type: 'boolean',
    },
    noAudio: {
      type: 'boolean',
    },
    subtitles: {
      type: 'boolean',
    },
    noSubtitles: {
      type: 'boolean',
    },
    help: {
      type: 'boolean',
      shortFlag: 'h',
      default: false,
    },
  } as const;
}

export async function runRenkuCli(
  argv = process.argv.slice(2),
  options: RunRenkuCliOptions = {}
): Promise<number> {
  const io = options.io ?? defaultIo;
  const cliFlags = createCliFlags();
  const cli = meow(helpText, {
    importMeta: import.meta,
    argv,
    autoHelp: false,
    flags: cliFlags,
  });

  const unknownFlags = findUnknownFlags(argv, cli.flags, Object.keys(cliFlags));
  if (!cli.flags.help && unknownFlags.length > 0) {
    writeStructuredError(
      new StructuredError({
        code: 'CLI005',
        message: 'Unknown CLI flag.',
        issues: unknownFlags.map((flag) =>
          createDiagnosticError(
            'CLI005',
            `Unknown flag: ${flag}.`,
            { path: ['arguments', flag], context: 'renku CLI arguments' },
            'Run renku --help to see supported flags.'
          )
        ),
      }),
      cli.flags.json,
      io
    );
    return 1;
  }

  if (cli.flags.help || cli.input[0] === 'help' || cli.input.length === 0) {
    io.stdout.log(cli.help);
    return 0;
  }

  const [command, ...input] = cli.input;

  try {
    switch (command) {
      case 'create':
        return await runCreateCommand({
          input,
          file: cli.flags.file,
          storageRoot: cli.flags.storageRoot,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'init':
        return await runInitCommand({
          input,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'about':
        return await runAboutCommand({ io });
      case 'asset':
        return await runAssetCommand({
          input,
          flags: {
            project: cli.flags.project,
            target: cli.flags.target,
            type: cli.flags.type,
            mediaKind: cli.flags.mediaKind,
            role: cli.flags.role,
            fileRole: cli.flags.fileRole,
            file: cli.flags.file,
            title: cli.flags.title,
            summary: cli.flags.summary,
            locale: cli.flags.locale,
            order: cli.flags.order,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'info':
        return await runProjectInformationCommand({
          input,
          flags: {
            project: cli.flags.project,
            title: cli.flags.title,
            aspectRatio: cli.flags.aspectRatio,
            logline: cli.flags.logline,
            summary: cli.flags.summary,
            displayName: cli.flags.displayName,
            base: cli.flags.base,
            audio: cli.flags.audio,
            noAudio: cli.flags.noAudio,
            subtitles: cli.flags.subtitles,
            noSubtitles: cli.flags.noSubtitles,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'production':
        return await runProductionCommand({
          input,
          flags: {
            project: cli.flags.project,
            locale: cli.flags.locale,
            allLocales: cli.flags.allLocales,
            dryRun: cli.flags.dryRun,
            fresh: cli.flags.fresh,
          },
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'project':
        return await runProjectSelectionCommand({
          input,
          storageRoot: cli.flags.storageRoot,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      case 'studio':
        return await runStudioCurrentCommand({
          input,
          json: cli.flags.json,
          io,
          homeDir: options.homeDir,
        });
      default:
        io.stderr.error(`Unknown command: ${command}`);
        io.stderr.error('Run `renku --help` to see available commands.');
        return 1;
    }
  } catch (error) {
    if (isStructuredError(error)) {
      writeStructuredError(error, cli.flags.json, io);
      return 1;
    }
    io.stderr.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function findUnknownFlags(
  argv: string[],
  receivedFlags: Record<string, unknown>,
  knownFlags: string[]
): string[] {
  const knownFlagSet = new Set(knownFlags);
  const unknownFlagSet = new Set(
    Object.keys(receivedFlags).filter((flag) => !knownFlagSet.has(flag))
  );
  const unknownTokens = argv
    .slice(0, argv.indexOf('--') === -1 ? argv.length : argv.indexOf('--'))
    .filter((argument) => unknownFlagSet.has(normalizeFlagToken(argument)));

  if (unknownTokens.length > 0) {
    return Array.from(new Set(unknownTokens));
  }

  return Array.from(unknownFlagSet, formatUnknownFlagName);
}

function normalizeFlagToken(argument: string): string {
  if (!argument.startsWith('-') || argument === '-') {
    return '';
  }
  const flagName = argument.replace(/^-+/, '').split('=')[0] ?? '';
  return toCamelCase(flagName.startsWith('no-') ? flagName.slice(3) : flagName);
}

function formatUnknownFlagName(flagName: string): string {
  return `--${flagName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function toCamelCase(flagName: string): string {
  return flagName.replace(/-([a-zA-Z0-9])/g, (_match, letter: string) =>
    letter.toUpperCase()
  );
}

function writeStructuredError(
  error: StructuredError,
  json: boolean,
  io: RenkuCliIo
): void {
  if (json) {
    io.stderr.error(
      JSON.stringify(
        {
          valid: false,
          error: {
            code: error.code,
            message: error.message,
            suggestion: error.suggestion,
          },
          issues: error.issues,
          errors: error.issues.filter((issue) => issue.severity === 'error'),
          warnings: error.issues.filter((issue) => issue.severity === 'warning'),
        },
        null,
        2
      )
    );
  } else {
    io.stderr.error(formatStructuredError(error));
  }
}

function formatStructuredError(error: {
  code: string;
  message: string;
  issues: DiagnosticIssue[];
  suggestion?: string;
}): string {
  const lines = [`[${error.code}] ${error.message}`];
  for (const issue of error.issues) {
    lines.push(formatDiagnosticIssue(issue));
  }
  if (error.suggestion) {
    lines.push(`Suggestion: ${error.suggestion}`);
  }
  return lines.join('\n');
}

export function formatDiagnosticIssue(issue: DiagnosticIssue): string {
  const location = formatDiagnosticLocation(issue.location.path);
  const suggestion = issue.suggestion ? ` Suggestion: ${issue.suggestion}` : '';
  return `[${issue.code}] ${issue.severity.toUpperCase()} ${location}: ${issue.message}${suggestion}`;
}

function formatDiagnosticLocation(path: string[]): string {
  if (path.length === 0) {
    return '<root>';
  }
  return path.reduce((label, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${label}[${segment}]`;
    }
    return label ? `${label}.${segment}` : segment;
  }, '');
}

const isEntrypoint = process.argv[1]?.endsWith('/cli.js') ?? false;

if (isEntrypoint) {
  runRenkuCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
