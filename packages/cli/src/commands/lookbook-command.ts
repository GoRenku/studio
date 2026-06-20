import fs from 'node:fs/promises';
import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type LookbookDocument,
  type LookbookSection,
  type LookbookSourceInspirationsDocument,
  type LookbookType,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export async function runLookbookCommand(options: {
  input: string[];
  flags: {
    file?: string;
    image?: string;
    lookbook?: string;
    name?: string;
    project?: string;
    sections?: string;
    type?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [action, nested, operation] = options.input;
  const service = createProjectDataService();
  const projectName = options.flags.project;

  if (action === 'list') {
    writeJson(
      options.io,
      await service.listLookbooks({ projectName, homeDir: options.homeDir })
    );
    return 0;
  }

  if (action === 'show') {
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

  if (action === 'validate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readJsonInput(filePath);
    writeJson(
      options.io,
      await service.validateLookbook({
        projectName,
        homeDir: options.homeDir,
        document: document as LookbookDocument,
        filePath: filePath !== '-' ? filePath : undefined,
      })
    );
    return 0;
  }

  if (action === 'create') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readJsonInput(filePath);
    const report = await service.createLookbook({
      projectName,
      homeDir: options.homeDir,
      name: options.flags.name,
      document: document as LookbookDocument,
      filePath: filePath !== '-' ? filePath : undefined,
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook create',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'update') {
    const filePath = options.flags.file;
    const document = filePath
      ? ((await readJsonInput(filePath)) as LookbookDocument)
      : undefined;
    const report = await service.updateLookbook({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
      name: options.flags.name,
      document,
      filePath: filePath && filePath !== '-' ? filePath : undefined,
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook update',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'rename') {
    const report = await service.renameLookbook({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
      name: requiredFlag(options.flags.name, '--name'),
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook rename',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'discard') {
    const report = await service.deleteLookbook({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook discard',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'select') {
    const type = parseLookbookType(options.flags.type);
    const report = await service.selectLookbookForType({
      projectName,
      homeDir: options.homeDir,
      type,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook select',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'clear-selection') {
    const type = parseLookbookType(options.flags.type);
    const report = await service.clearLookbookSelection({
      projectName,
      homeDir: options.homeDir,
      type,
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook clear-selection',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'image' && nested === 'set-sections') {
    const report = await service.setLookbookImageSections({
      projectName,
      homeDir: options.homeDir,
      imageId: requiredFlag(options.flags.image, '--image'),
      sections: parseSections(options.flags.sections),
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook image set-sections',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'image' && nested === 'discard') {
    const report = await service.deleteLookbookImage({
      projectName,
      homeDir: options.homeDir,
      imageId: requiredFlag(options.flags.image, '--image'),
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook image discard',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'card-image' && nested === 'set') {
    const report = await service.setLookbookCardImage({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
      imageId: requiredFlag(options.flags.image, '--image'),
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook card-image set',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'card-image' && nested === 'clear') {
    const report = await service.clearLookbookCardImage({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook card-image clear',
    });
    writeJson(options.io, report);
    return 0;
  }

  if (action === 'inspiration' && nested === 'list') {
    writeJson(
      options.io,
      await service.listLookbookSourceInspirations({
        projectName,
        homeDir: options.homeDir,
        lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
      })
    );
    return 0;
  }

  if (action === 'inspiration' && nested === 'set') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readJsonInput(filePath);
    const report = await service.setLookbookSourceInspirations({
      projectName,
      homeDir: options.homeDir,
      lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
      document: document as LookbookSourceInspirationsDocument,
      filePath: filePath !== '-' ? filePath : undefined,
    });
    await appendStudioResourceChangedEvent({
      runtime: cliRuntime(options, service),
      report,
      command: 'lookbook inspiration set',
    });
    writeJson(options.io, report);
    return 0;
  }

  throw new StructuredError({
    code: 'CLI095',
    message: 'Unknown lookbook command.',
    issues: [
      createDiagnosticError(
        'CLI095',
        'Unknown lookbook command.',
        { path: ['lookbook', action ?? '', nested ?? '', operation ?? ''] },
        'Use list/show/validate/create/update/rename/discard/select/clear-selection, image set-sections/discard, card-image set/clear, or inspiration list/set.'
      ),
    ],
    suggestion: 'Use a supported lookbook command.',
  });
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
      suggestion:
        'Check that the file exists and is readable, or pass `--file -` for stdin.',
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

function parseSections(input?: string): LookbookSection[] {
  if (!input) {
    return [];
  }
  return input
    .split(',')
    .map((section) => section.trim())
    .filter(Boolean) as LookbookSection[];
}

function parseLookbookType(input?: string): LookbookType {
  const value = requiredFlag(input, '--type');
  if (value === 'movie' || value === 'storyboard') {
    return value;
  }
  throw new StructuredError({
    code: 'CLI096',
    message: 'Unsupported Lookbook type.',
    issues: [
      createDiagnosticError(
        'CLI096',
        `Unsupported Lookbook type: ${value}.`,
        { path: ['--type'], context: 'renku CLI arguments' },
        'Use movie or storyboard.'
      ),
    ],
    suggestion: 'Use --type movie or --type storyboard.',
  });
}

function cliRuntime(
  options: {
    json: boolean;
    io: RenkuCliIo;
    homeDir?: string;
  },
  projectDataService: ReturnType<typeof createProjectDataService>
) {
  return {
    homeDir: options.homeDir,
    json: options.json,
    io: options.io,
    projectDataService,
  };
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
