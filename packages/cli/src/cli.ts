#!/usr/bin/env node
import { isStructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import meow from 'meow';
import { runCreateCommand } from './commands/create-project-command.js';
import { getRenkuCliInfo } from './commands/info.js';
import { runInitCommand } from './commands/initialize-config-command.js';

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
  create --file <yaml>  Create a project from YAML
  init <storage-root>  Create or inspect the global Renku config
  info                 Show Renku CLI package information

Options
  --file               Project create YAML file
  --cover              Optional PNG cover image
  --json               Print machine-readable JSON
  --help, -h           Show help
  --version            Show version

Examples
  $ renku create --file sample-project.yaml
  $ renku create --file sample-project.yaml --cover cover.png
  $ renku init ~/Movies/renku
  $ renku init /Volumes/Media/Renku --json
`;

export async function runRenkuCli(
  argv = process.argv.slice(2),
  options: RunRenkuCliOptions = {}
): Promise<number> {
  const io = options.io ?? defaultIo;
  const cli = meow(helpText, {
    importMeta: import.meta,
    argv,
    autoHelp: false,
    flags: {
      json: {
        type: 'boolean',
        default: false,
      },
      file: {
        type: 'string',
      },
      cover: {
        type: 'string',
      },
      help: {
        type: 'boolean',
        shortFlag: 'h',
        default: false,
      },
    },
  });

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
          cover: cli.flags.cover,
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
      case 'info':
        io.stdout.log(JSON.stringify(getRenkuCliInfo(), null, 2));
        return 0;
      default:
        io.stderr.error(`Unknown command: ${command}`);
        io.stderr.error('Run `renku --help` to see available commands.');
        return 1;
    }
  } catch (error) {
    if (isStructuredError(error)) {
      if (cli.flags.json) {
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
      return 1;
    }
    io.stderr.error(error instanceof Error ? error.message : String(error));
    return 1;
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
