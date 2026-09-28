#!/usr/bin/env node
import { channel } from 'node:diagnostics_channel';
import {
  createDiagnosticError,
  isStructuredError,
  StructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { parseCliArguments, singleCommandFlagValue } from './arguments.js';
import { dispatchCommand } from './commands/registry.js';
import {
  isRenkuCliEntrypoint,
  requireSupportedNodeVersion,
} from './runtime/node-runtime.js';

export interface RenkuCliIo {
  stdout: Pick<typeof console, 'log'>;
  stderr: Pick<typeof console, 'error'>;
}

export interface RunRenkuCliOptions {
  io?: RenkuCliIo;
  homeDir?: string;
}

const performanceChannel = channel('renku.performance');

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

export async function runRenkuCli(
  argv = process.argv.slice(2),
  options: RunRenkuCliOptions = {}
): Promise<number> {
  const io = options.io ?? defaultIo;
  const { cli, unknownFlags } = parseCliArguments(argv);
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

  const started = performanceChannel.hasSubscribers ? performance.now() : undefined;
  let outcome = 'success';
  try {
    requireSupportedNodeVersion();
    const isGenerationPreview =
      command === 'generation' && input.join(' ') === 'preview show';
    const file = isGenerationPreview
      ? undefined
      : singleCommandFlagValue(cli.flags.file, '--file');
    const exitCode = await dispatchCommand(command!, { input, flags: cli.flags, file,
      isGenerationPreview, io, homeDir: options.homeDir });
    outcome = exitCode === 0 ? 'success' : 'failure';
    return exitCode;
  } catch (error) {
    outcome = 'failure';
    if (isStructuredError(error)) {
      writeStructuredError(error, cli.flags.json, io);
      return 1;
    }
    io.stderr.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    if (started !== undefined) {
      performanceChannel.publish({ package: 'cli', phase: 'command', durationMs: performance.now() - started, outcome });
    }
  }
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

const isEntrypoint = isRenkuCliEntrypoint(process.argv[1]);

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
