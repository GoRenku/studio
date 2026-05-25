import fs from 'node:fs/promises';
import {
  createProjectDataService,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';

export async function runMediaCommand(options: {
  input: string[];
  flags: {
    project?: string;
    purpose?: string;
    target?: string;
    source?: string;
    title?: string;
    summary?: string;
    sections?: string;
    receipt?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [action] = options.input;
  if (action === 'import') {
    const service = createProjectDataService();
    writeJson(
      options.io,
        await service.importLookbookImageMedia({
          projectName: options.flags.project,
          homeDir: options.homeDir,
          lookbookId: parseLookbookImport(
            requiredFlag(options.flags.purpose, '--purpose'),
            requiredFlag(options.flags.target, '--target')
          ),
          sourceProjectRelativePath: requiredFlag(options.flags.source, '--source'),
          title: options.flags.title,
        oneLineSummary: options.flags.summary,
        sections: parseSections(options.flags.sections),
        receipt: options.flags.receipt
          ? await readReceipt(options.flags.receipt)
          : undefined,
      })
    );
    return 0;
  }

  throw new StructuredError({
    code: 'CLI023',
    message: `Unknown media command: ${options.input.join(' ') || '(none)'}.`,
    suggestion: 'Use media import.',
  });
}

async function readReceipt(filePath: string): Promise<unknown> {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
    receipt?: unknown;
  };
  return parsed.receipt ?? parsed;
}

function parseLookbookImport(purpose: string, target: string): string {
  if (purpose !== 'lookbook.image') {
    throw new StructuredError({
      code: 'CLI024',
      message: `Unsupported media import purpose: ${purpose}.`,
      suggestion: 'Use --purpose lookbook.image.',
    });
  }
  const [kind, id, extra] = target.split(':');
  if (kind !== 'lookbook' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Lookbook image import target must use lookbook:<id>. Received: ${target}.`,
      suggestion: 'Use --target lookbook:<lookbook-id>.',
    });
  }
  return id;
}

function parseSections(value: string | undefined): string[] | undefined {
  return value
    ?.split(',')
    .map((section) => section.trim())
    .filter(Boolean);
}

function requiredFlag(value: string | undefined, flag: string): string {
  if (!value) {
    throw new StructuredError({
      code: 'CLI001',
      message: `Missing required flag: ${flag}.`,
    });
  }
  return value;
}

function writeJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
}
