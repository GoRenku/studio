import fs from 'node:fs/promises';
import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import type { ScreenplayInput, ScreenplayOperationsInput } from '@gorenku/studio-core/server';
import type { ScreenplayCommandContext } from './index.js';
import {
  notifyScreenplayMutation,
  requiredScreenplayFlag,
  resolveScreenplayProjectName,
  writeScreenplayJson,
} from './index.js';

export async function runScreenplayAuthoringCommand(context: ScreenplayCommandContext): Promise<number> {
  const [subcommand] = context.input;
  const projectName = await resolveScreenplayProjectName(context);
  const filePath = requiredScreenplayFlag(context.flags.file, '--file');
  const document = await readScreenplayJsonInput(filePath);

  const report = subcommand === 'create'
    ? await context.service.createScreenplay({
        homeDir: context.homeDir,
        projectName,
        screenplay: document as ScreenplayInput,
      })
    : await context.service.applyScreenplayOperations({
        homeDir: context.homeDir,
        projectName,
        operations: (document as ScreenplayOperationsInput).operations,
      });

  await notifyScreenplayMutation(context, report, `screenplay ${subcommand}`);
  writeScreenplayJson(context.io, report);
  return 0;
}

export async function readScreenplayJsonInput(filePath: string): Promise<unknown> {
  const contents = filePath === '-' ? await readStdin() : await readFile(filePath);
  try {
    return JSON.parse(contents);
  } catch {
    throw new StructuredError({
      code: 'PROJECT_DATA201',
      message: 'Input must be valid JSON.',
      issues: [createDiagnosticError(
        'PROJECT_DATA201',
        'Input must be valid JSON.',
        { path: [], ...(filePath !== '-' ? { filePath } : {}) },
        'Provide a valid JSON object.',
      )],
      suggestion: 'Provide a valid JSON object.',
    });
  }
}

async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    throw new StructuredError({
      code: 'CLI082',
      message: 'Could not read JSON input file.',
      issues: [createDiagnosticError(
        'CLI082',
        `Could not read JSON input file: ${filePath}.`,
        { path: ['--file'], filePath },
        'Check that the file exists and is readable, or pass `--file -` for stdin.',
      )],
      suggestion: 'Check that the file exists and is readable, or pass `--file -` for stdin.',
    });
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
  } catch {
    throw new StructuredError({
      code: 'CLI083',
      message: 'Could not read stdin.',
      issues: [createDiagnosticError('CLI083', 'Could not read stdin.', { path: ['stdin'] }, 'Send a complete JSON document on stdin.')],
      suggestion: 'Send a complete JSON document on stdin.',
    });
  }
  return Buffer.concat(chunks).toString('utf8');
}
