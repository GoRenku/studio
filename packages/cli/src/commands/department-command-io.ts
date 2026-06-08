import fs from 'node:fs/promises';
import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';

export function requiredFlag(value: string | undefined, flag: string): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new StructuredError({
    code: 'CLI090',
    message: `${flag} is required.`,
    issues: [
      createDiagnosticError(
        'CLI090',
        `${flag} is required.`,
        { path: [flag], context: 'renku CLI arguments' },
        `Pass ${flag}.`
      ),
    ],
    suggestion: `Pass ${flag}.`,
  });
}

export async function readRequiredJsonInput(
  file: string | undefined,
  command: string
): Promise<unknown> {
  if (!file) {
    throw new StructuredError({
      code: 'CLI080',
      message: `${command} requires --file.`,
      issues: [
        createDiagnosticError(
          'CLI080',
          `${command} requires --file.`,
          { path: ['--file'], context: 'renku CLI arguments' },
          `Run \`renku ${command} --file <json-file> --json\`.`
        ),
      ],
      suggestion: `Run \`renku ${command} --file <json-file> --json\`.`,
    });
  }
  return readJsonInput(file);
}

export async function readJsonInput(file: string): Promise<unknown> {
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

export function writeJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
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
        createDiagnosticError(
          'CLI083',
          'Could not read stdin.',
          { path: ['stdin'] },
          'Send a complete JSON document on stdin.'
        ),
      ],
      suggestion: 'Send a complete JSON document on stdin.',
    });
  }
}
