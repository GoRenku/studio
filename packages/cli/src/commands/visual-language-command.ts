import fs from 'node:fs/promises';
import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type LookbookSection,
  type LookbookSections,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runVisualLanguageCommand(options: {
  input: string[];
  flags: {
    file?: string;
    folder?: string;
    lookbook?: string;
    name?: string;
    project?: string;
    sections?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [area, action] = options.input;
  const service = createProjectDataService();
  const projectName = options.flags.project;

  if (area === 'lookbook' && action === 'read') {
    writeJson(
      options.io,
      await service.readLookbook({
        projectName,
        homeDir: options.homeDir,
        lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
      })
    );
    return 0;
  }
  if (area === 'lookbook' && action === 'list') {
    writeJson(
      options.io,
      await service.listLookbooks({ projectName, homeDir: options.homeDir })
    );
    return 0;
  }
  if (area === 'lookbook' && action === 'create') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const sections = await readJsonInput(filePath);
    writeJson(
      options.io,
      await service.createLookbook({
        projectName,
        homeDir: options.homeDir,
        name: requiredFlag(options.flags.name, '--name'),
        sections: sections as LookbookSections,
        filePath: filePath !== '-' ? filePath : undefined,
      })
    );
    return 0;
  }
  if (area === 'lookbook' && action === 'update') {
    const filePath = options.flags.file;
    const sections = filePath ? await readJsonInput(filePath) : undefined;
    writeJson(
      options.io,
      await service.updateLookbook({
        projectName,
        homeDir: options.homeDir,
        lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
        name: options.flags.name,
        sections: sections as LookbookSections | undefined,
        filePath: filePath && filePath !== '-' ? filePath : undefined,
      })
    );
    return 0;
  }
  if (area === 'lookbook' && action === 'delete') {
    await service.deleteLookbook({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
    });
    writeJson(options.io, { ok: true });
    return 0;
  }
  if (area === 'lookbook' && action === 'set-active') {
    await service.setActiveLookbook({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
    });
    writeJson(options.io, { ok: true });
    return 0;
  }
  if (area === 'lookbook' && action === 'clear-active') {
    await service.clearActiveLookbook({
      projectName,
      homeDir: options.homeDir,
    });
    writeJson(options.io, { ok: true });
    return 0;
  }
  if (area === 'lookbook' && action === 'import-image') {
    writeJson(
      options.io,
      await service.importLookbookImage({
        projectName,
        homeDir: options.homeDir,
        lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
        projectRelativePath: requiredFlag(options.flags.file, '--file'),
        sections: parseSections(options.flags.sections),
      })
    );
    return 0;
  }
  if (area === 'lookbook' && action === 'set-card-image') {
    writeJson(
      options.io,
      await service.setLookbookCardImage({
        projectName,
        homeDir: options.homeDir,
        lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
        imageId: requiredFlag(options.flags.file, '--file'),
      })
    );
    return 0;
  }

  throw new StructuredError({
    code: 'CLI091',
    message: 'Unknown visual-language command.',
    issues: [
      createDiagnosticError(
        'CLI091',
        'Unknown visual-language command.',
        { path: ['visual-language', area ?? '', action ?? ''] },
        'Use lookbook list/read/create/update/delete/set-active/clear-active/import-image/set-card-image. Inspiration commands now live under `renku inspiration`.'
      ),
    ],
    suggestion: 'Use a supported visual-language command.',
  });
}

async function readJsonInput(file: string): Promise<unknown> {
  const contents = file === '-' ? await readStdin() : await fs.readFile(file, 'utf8');
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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseSections(input?: string): LookbookSection[] {
  if (!input) {
    return [];
  }
  return input
    .split(',')
    .map((section) => section.trim())
    .filter(Boolean) as LookbookSection[];
}

function requiredFlag(value: string | undefined, flag: string): string {
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

function writeJson(io: RenkuCliIo, value: unknown): void {
  io.stdout.log(JSON.stringify(value, null, 2));
}
