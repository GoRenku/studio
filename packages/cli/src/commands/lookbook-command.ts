import fs from 'node:fs/promises';
import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  type LookbookDocument,
  type LookbookKind,
  type LookbookSection,
  type LookbookSourceInspirationsDocument,
  type ProductionLookbookDocument,
  type StoryboardLookbookDocument,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import { parseAnchor } from './studio-target-parsing.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

type LookbookCommandOptions = {
  input: string[];
  flags: {
    anchor?: string;
    file?: string;
    image?: string;
    kind?: string;
    lookbook?: string;
    project?: string;
    sections?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
};

type Service = ReturnType<typeof createProjectDataService>;

export async function runLookbookCommand(
  options: LookbookCommandOptions
): Promise<number> {
  const [action, nested, operation] = options.input;
  const service = createProjectDataService();
  if (action === 'show') {
    return showLookbook(options, service);
  }
  if (action === 'validate') {
    return validateLookbook(options, service);
  }
  if (action === 'apply') {
    return applyLookbook(options, service);
  }
  if (action === 'image' && nested === 'set-placement') {
    return setImagePlacement(options, service);
  }
  if (action === 'image' && nested === 'discard') {
    return discardImage(options, service);
  }
  if (action === 'card-image' && nested === 'set') {
    return setCardImage(options, service);
  }
  if (action === 'card-image' && nested === 'clear') {
    return clearCardImage(options, service);
  }
  if (action === 'inspiration' && nested === 'list') {
    return listInspirations(options, service);
  }
  if (action === 'inspiration' && nested === 'set') {
    return setInspirations(options, service);
  }
  throw unknownCommand(action, nested, operation);
}

async function showLookbook(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const kind = parseLookbookKind(options.flags.kind);
  const report = kind === 'production'
    ? await service.readProductionLookbook(projectInput(options))
    : await service.readStoryboardLookbook(projectInput(options));
  return writeJson(options, report);
}

async function validateLookbook(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const { document, filePath } = await readDocument(options);
  const report = document.kind === 'productionLookbook'
    ? await service.validateProductionLookbook({
        ...projectInput(options),
        document,
        filePath,
      })
    : await service.validateStoryboardLookbook({
        ...projectInput(options),
        document,
        filePath,
      });
  return writeJson(options, report);
}

async function applyLookbook(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const { document, filePath } = await readDocument(options);
  const report = document.kind === 'productionLookbook'
    ? await service.writeProductionLookbook({
        ...projectInput(options),
        document,
        filePath,
      })
    : await service.writeStoryboardLookbook({
        ...projectInput(options),
        document,
        filePath,
      });
  await notify(options, service, report, 'lookbook apply');
  return writeJson(options, report);
}

async function setImagePlacement(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const report = await service.setLookbookImagePlacement({
    ...projectInput(options),
    imageId: requiredFlag(options.flags.image, '--image'),
    sections: parseSections(options.flags.sections),
    anchorPointId: parseAnchor(options.flags.anchor),
  });
  await notify(options, service, report, 'lookbook image set-placement');
  return writeJson(options, report);
}

async function discardImage(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const report = await service.deleteLookbookImage({
    ...projectInput(options),
    imageId: requiredFlag(options.flags.image, '--image'),
  });
  await notify(options, service, report, 'lookbook image discard');
  return writeJson(options, report);
}

async function setCardImage(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const report = await service.setLookbookCardImage({
    ...projectInput(options),
    lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
    imageId: requiredFlag(options.flags.image, '--image'),
  });
  await notify(options, service, report, 'lookbook card-image set');
  return writeJson(options, report);
}

async function clearCardImage(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const report = await service.clearLookbookCardImage({
    ...projectInput(options),
    lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
  });
  await notify(options, service, report, 'lookbook card-image clear');
  return writeJson(options, report);
}

async function listInspirations(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const report = await service.listLookbookSourceInspirations({
    ...projectInput(options),
    lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
  });
  return writeJson(options, report);
}

async function setInspirations(
  options: LookbookCommandOptions,
  service: Service
): Promise<number> {
  const file = requiredFlag(options.flags.file, '--file');
  const document = await readJsonInput(file) as LookbookSourceInspirationsDocument;
  const report = await service.setLookbookSourceInspirations({
    ...projectInput(options),
    lookbookId: requiredFlag(options.flags.lookbook, '--lookbook'),
    document,
    filePath: file === '-' ? undefined : file,
  });
  await notify(options, service, report, 'lookbook inspiration set');
  return writeJson(options, report);
}

async function readDocument(options: LookbookCommandOptions): Promise<{
  document: ProductionLookbookDocument | StoryboardLookbookDocument;
  filePath?: string;
}> {
  const file = requiredFlag(options.flags.file, '--file');
  const document = await readJsonInput(file) as LookbookDocument;
  if (document.kind !== 'productionLookbook' && document.kind !== 'storyboardLookbook') {
    throw new StructuredError({
      code: 'CORE_LOOKBOOK_TARGET_KIND_INVALID',
      message: 'Lookbook document kind is required.',
      issues: [
        createDiagnosticError(
          'CORE_LOOKBOOK_TARGET_KIND_INVALID',
          'Lookbook document kind must be productionLookbook or storyboardLookbook.',
          { path: ['kind'], ...(file !== '-' ? { filePath: file } : {}) },
          'Use a current Lookbook document kind.'
        ),
      ],
      suggestion: 'Use productionLookbook or storyboardLookbook.',
    });
  }
  return { document, ...(file !== '-' ? { filePath: file } : {}) };
}

function parseLookbookKind(input?: string): LookbookKind {
  const value = requiredFlag(input, '--kind');
  if (value === 'production' || value === 'storyboard') {
    return value;
  }
  throw new StructuredError({
    code: 'CLI096',
    message: 'Unsupported Lookbook kind.',
    issues: [
      createDiagnosticError(
        'CLI096',
        `Unsupported Lookbook kind: ${value}.`,
        { path: ['--kind'], context: 'renku CLI arguments' },
        'Use production or storyboard.'
      ),
    ],
    suggestion: 'Use --kind production or --kind storyboard.',
  });
}

function projectInput(options: LookbookCommandOptions): {
  projectName?: string;
  homeDir?: string;
} {
  return { projectName: options.flags.project, homeDir: options.homeDir };
}

async function notify(
  options: LookbookCommandOptions,
  service: Service,
  report: { project: { name: string; id?: string }; resourceKeys: string[] },
  command: string
): Promise<void> {
  await appendStudioResourceChangedEvent({
    runtime: {
      homeDir: options.homeDir,
      json: options.json,
      io: options.io,
      projectDataService: service,
    },
    report,
    command,
  });
}

function writeJson(options: LookbookCommandOptions, value: unknown): number {
  options.io.stdout.log(JSON.stringify(value, null, 2));
  return 0;
}

function unknownCommand(
  action?: string,
  nested?: string,
  operation?: string
): StructuredError {
  return new StructuredError({
    code: 'CLI095',
    message: 'Unknown lookbook command.',
    issues: [
      createDiagnosticError(
        'CLI095',
        'Unknown lookbook command.',
        { path: ['lookbook', action ?? '', nested ?? '', operation ?? ''] },
        'Use show/validate/apply, image set-placement/discard, card-image set/clear, or inspiration list/set.'
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
      suggestion: 'Check that the file exists and is readable.',
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
  return input
    ? (input
        .split(',')
        .map((section) => section.trim())
        .filter(Boolean) as LookbookSection[])
    : [];
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
