import fs from 'node:fs/promises';
import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type ScreenplayCreateDocument,
  type ScreenplayDocument,
  type ScreenplayOperationDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runScreenplayCommand(options: {
  input: string[];
  flags: {
    file?: string;
    act?: string;
    sequence?: string;
    dryRun?: boolean;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [subcommand, nested, id] = options.input;
  const service = createProjectDataService();

  if (subcommand === 'status') {
    writeJson(options.io, await service.readScreenplayStatus({ homeDir: options.homeDir }));
    return 0;
  }
  if (subcommand === 'show') {
    const report = await service.readScreenplay({ homeDir: options.homeDir });
    writeJson(options.io, report.screenplay);
    return 0;
  }
  if (subcommand === 'validate') {
    const document = options.flags.file
      ? await readJsonInput(options.flags.file)
      : undefined;
    writeJson(
      options.io,
      await service.validateScreenplayJson({
        homeDir: options.homeDir,
        document: document as ScreenplayDocument | ScreenplayOperationDocument | undefined,
        filePath: options.flags.file && options.flags.file !== '-' ? options.flags.file : undefined,
      })
    );
    return 0;
  }
  if (subcommand === 'create') {
    const document = await readRequiredJsonInput(options.flags.file, 'create');
    writeJson(
      options.io,
      await service.createScreenplay({
        homeDir: options.homeDir,
        document: document as ScreenplayCreateDocument,
        filePath: options.flags.file !== '-' ? options.flags.file : undefined,
        dryRun: options.flags.dryRun,
      })
    );
    return 0;
  }
  if (subcommand === 'apply') {
    const document = await readRequiredJsonInput(options.flags.file, 'apply');
    writeJson(
      options.io,
      await service.applyScreenplayOperations({
        homeDir: options.homeDir,
        document: document as ScreenplayOperationDocument,
        filePath: options.flags.file !== '-' ? options.flags.file : undefined,
        dryRun: options.flags.dryRun,
      })
    );
    return 0;
  }
  if (subcommand === 'cast' && nested === 'list') {
    writeJson(options.io, await service.listScreenplayCastMembers({ homeDir: options.homeDir }));
    return 0;
  }
  if (subcommand === 'cast' && nested === 'show' && id) {
    writeJson(options.io, await service.readScreenplayCastMember({ homeDir: options.homeDir, castMemberId: id }));
    return 0;
  }
  if (subcommand === 'location' && nested === 'list') {
    writeJson(options.io, await service.listScreenplayLocations({ homeDir: options.homeDir }));
    return 0;
  }
  if (subcommand === 'location' && nested === 'show' && id) {
    writeJson(options.io, await service.readScreenplayLocation({ homeDir: options.homeDir, locationId: id }));
    return 0;
  }
  if (subcommand === 'act' && nested === 'list') {
    writeJson(options.io, await service.listScreenplayActs({ homeDir: options.homeDir }));
    return 0;
  }
  if (subcommand === 'act' && nested === 'show' && id) {
    writeJson(options.io, await service.readScreenplayAct({ homeDir: options.homeDir, actId: id }));
    return 0;
  }
  if (subcommand === 'sequence' && nested === 'list' && options.flags.act) {
    writeJson(options.io, await service.listScreenplaySequencesForAct({ homeDir: options.homeDir, actId: options.flags.act }));
    return 0;
  }
  if (subcommand === 'sequence' && nested === 'show' && id) {
    writeJson(options.io, await service.readScreenplaySequence({ homeDir: options.homeDir, sequenceId: id }));
    return 0;
  }
  if (subcommand === 'scene' && nested === 'list' && options.flags.sequence) {
    writeJson(options.io, await service.listScreenplayScenesForSequence({ homeDir: options.homeDir, sequenceId: options.flags.sequence }));
    return 0;
  }
  if (subcommand === 'scene' && nested === 'show' && id) {
    writeJson(options.io, await service.readScreenplayScene({ homeDir: options.homeDir, sceneId: id }));
    return 0;
  }

  throw new StructuredError({
    code: 'CLI081',
    message: 'Unknown screenplay command.',
    issues: [
      createDiagnosticError(
        'CLI081',
        'Unknown screenplay command.',
        { path: ['screenplay', subcommand ?? ''] },
        'Use status, show, validate, create, apply, cast, location, act, sequence, or scene.'
      ),
    ],
    suggestion: 'Use a supported screenplay command.',
  });
}

async function readRequiredJsonInput(file: string | undefined, command: string): Promise<unknown> {
  if (!file) {
    throw new StructuredError({
      code: 'CLI080',
      message: `screenplay ${command} requires --file.`,
      issues: [
        createDiagnosticError(
          'CLI080',
          `screenplay ${command} requires --file.`,
          { path: ['--file'], context: 'renku CLI arguments' },
          `Run \`renku screenplay ${command} --file <screenplay-json> --json\`.`
        ),
      ],
      suggestion: `Run \`renku screenplay ${command} --file <screenplay-json> --json\`.`,
    });
  }
  return readJsonInput(file);
}

async function readJsonInput(file: string): Promise<unknown> {
  const contents = file === '-' ? await readStdin() : await readFile(file);
  try {
    return JSON.parse(contents);
  } catch {
    throw new StructuredError({
      code: 'PROJECT_DATA201',
      message: 'Input must be valid JSON.',
      issues: [
        createDiagnosticError(
          'PROJECT_DATA201',
          'Input must be valid JSON.',
          { path: [], ...(file !== '-' ? { filePath: file } : {}) },
          'Provide a valid JSON object.'
        ),
      ],
      suggestion: 'Provide a valid JSON object.',
    });
  }
}

async function readFile(file: string): Promise<string> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    throw new StructuredError({
      code: 'CLI082',
      message: 'Could not read JSON input file.',
      issues: [
        createDiagnosticError(
          'CLI082',
          `Could not read JSON input file: ${file}.`,
          { path: ['--file'], filePath: file },
          'Check that the file exists and is readable, or pass `--file -` for stdin.'
        ),
      ],
      suggestion: 'Check that the file exists and is readable, or pass `--file -` for stdin.',
    });
  }
}

async function readStdin(): Promise<string> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch {
    throw new StructuredError({
      code: 'CLI083',
      message: 'Could not read stdin.',
      issues: [
        createDiagnosticError('CLI083', 'Could not read stdin.', { path: ['stdin'] }, 'Send a complete JSON document on stdin.'),
      ],
      suggestion: 'Send a complete JSON document on stdin.',
    });
  }
}

function writeJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
}
