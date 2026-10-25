import { createInterface } from 'node:readline/promises';
import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  readCodexPermissionsFile,
  readRenkuSetup,
  removeCodexPermissionsFile,
  resolveRenkuStateDir,
  writeCodexPermissionsFile,
  type CodexPermissionsFile,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import { checkCodexSandbox, type CodexSandboxCheck } from './codex-sandbox-check.js';

export interface RunCodexPermissionsCommandOptions {
  input: string[];
  json: boolean;
  yes: boolean;
  io: RenkuCliIo;
  homeDir?: string;
  /** Asks the user a yes/no question; replaced in tests. */
  confirm?: (question: string) => Promise<boolean>;
  /** Runs the Codex sandbox check; replaced in tests. */
  checkSandbox?: typeof checkCodexSandbox;
}

interface CodexPermissionsReport {
  file: Omit<CodexPermissionsFile, 'contents'>;
  sandbox: CodexSandboxCheck | null;
}

type Subcommand = (options: RunCodexPermissionsCommandOptions, projectLibrary: string) => Promise<CodexPermissionsReport>;

const SUBCOMMANDS: Record<string, Subcommand> = {
  status: async (options, projectLibrary) => withSandboxCheck(options, await readCodexPermissionsFile({ homeDir: options.homeDir, projectLibrary })),
  set: async (options, projectLibrary) => {
    const planned = await readCodexPermissionsFile({ homeDir: options.homeDir, projectLibrary });
    if (planned.state !== 'current' && planned.state !== 'foreign') {
      await requireConfirmation(options, [
        `Renku will ${planned.state === 'missing' ? 'add' : 'update'} Codex permissions for your Project Library only:`,
        `  ${planned.path}`,
        '',
        ...planned.contents.trimEnd().split('\n').map((line) => `    ${line}`),
        '',
        'Codex uses this file only when it works in that folder. Your other Codex projects and your personal Codex settings are not changed.',
      ], 'Write this file?');
    }
    return withSandboxCheck(options, await writeCodexPermissionsFile({ homeDir: options.homeDir, projectLibrary }));
  },
  remove: async (options, projectLibrary) => {
    const current = await readCodexPermissionsFile({ homeDir: options.homeDir, projectLibrary });
    if (current.state !== 'missing' && current.state !== 'foreign') {
      await requireConfirmation(options, [`Renku will delete ${current.path}.`], 'Remove Renku\'s Codex permissions?');
    }
    return { file: summary(await removeCodexPermissionsFile({ homeDir: options.homeDir, projectLibrary })), sandbox: null };
  },
};

export async function runCodexPermissionsCommand(options: RunCodexPermissionsCommandOptions): Promise<number> {
  const subcommand = options.input[0] === 'permissions' && options.input.length === 2 ? SUBCOMMANDS[options.input[1] ?? ''] : undefined;
  if (!subcommand) {
    throw unknownCommandError(options.input);
  }
  const setup = await readRenkuSetup({ homeDir: options.homeDir });
  if (setup.status !== 'configured') {
    throw new StructuredError({
      code: 'CLI171',
      message: 'Renku has no Project Library yet.',
      suggestion: 'Open Studio to choose a Project Library, or run renku init <storage-root>. Codex permissions are set up with it.',
    });
  }
  const report = await subcommand(options, setup.storageRoot);
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
  } else {
    formatReport(report).forEach((line) => options.io.stdout.log(line));
  }
  return 0;
}

async function withSandboxCheck(options: RunCodexPermissionsCommandOptions, file: CodexPermissionsFile): Promise<CodexPermissionsReport> {
  const sandbox = file.state === 'current'
    ? (options.checkSandbox ?? checkCodexSandbox)({ projectLibrary: file.projectLibrary, stateDir: resolveRenkuStateDir({ homeDir: options.homeDir }) })
    : null;
  return { file: summary(file), sandbox };
}

async function requireConfirmation(options: RunCodexPermissionsCommandOptions, lines: string[], question: string): Promise<void> {
  if (options.yes) {
    return;
  }
  if (options.json || (!options.confirm && !process.stdin.isTTY)) {
    throw new StructuredError({
      code: 'CLI170',
      message: 'This command changes Codex settings and needs your confirmation.',
      suggestion: 'Run it in a terminal to review and confirm, or add --yes.',
    });
  }
  lines.forEach((line) => options.io.stdout.log(line));
  if (!(await (options.confirm ?? askYesNo)(question))) {
    throw new StructuredError({ code: 'CLI172', message: 'Nothing was changed.' });
  }
}

async function askYesNo(question: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await prompt.question(`${question} [y/N] `)).trim());
  } finally {
    prompt.close();
  }
}

function summary(file: CodexPermissionsFile): CodexPermissionsReport['file'] {
  return { projectLibrary: file.projectLibrary, path: file.path, state: file.state };
}

const STATE_LINES: Record<CodexPermissionsFile['state'], (file: CodexPermissionsReport['file']) => string> = {
  current: (file) => `Codex permissions: set up for ${file.projectLibrary}`,
  outdated: (file) => `Codex permissions: out of date in ${file.path}. Run renku codex permissions set to refresh them.`,
  missing: (file) => `Codex permissions: not set up for ${file.projectLibrary}. Run renku codex permissions set.`,
  foreign: (file) => `Codex permissions: ${file.path} has your own Codex settings, which Renku leaves unchanged.`,
};

const SANDBOX_LINES: Record<CodexSandboxCheck, (file: CodexPermissionsReport['file']) => string> = {
  writable: () => 'Codex check: Renku can save its data. Start a new Codex thread in your Project Library to use these permissions.',
  refused: (file) => `Codex check: refused. Open Codex in ${file.projectLibrary} and trust the folder when Codex asks, then run renku codex permissions status.`,
  unavailable: () => 'Codex check: skipped, the codex command was not found.',
};

function formatReport(report: CodexPermissionsReport): string[] {
  return [STATE_LINES[report.file.state](report.file), ...(report.sandbox ? [SANDBOX_LINES[report.sandbox](report.file)] : [])];
}

function unknownCommandError(input: string[]): StructuredError {
  return new StructuredError({
    code: 'CLI173',
    message: 'Unknown codex command.',
    issues: [
      createDiagnosticError('CLI173', input.length === 0 ? 'Missing codex subcommand.' : `Unsupported codex subcommand: ${input.join(' ')}`, { path: ['codex'], context: 'renku CLI arguments' }),
    ],
    suggestion: 'Use `renku codex permissions status`, `renku codex permissions set` or `renku codex permissions remove`.',
  });
}
