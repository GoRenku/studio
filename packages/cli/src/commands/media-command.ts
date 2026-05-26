import fs from 'node:fs/promises';
import {
  createProjectDataService,
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
  type CastMediaImportReport,
  type LookbookImageMediaImportReport,
  type StudioProjectRef,
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
    const purpose = requiredFlag(options.flags.purpose, '--purpose');
    const target = requiredFlag(options.flags.target, '--target');
    const sourceProjectRelativePath = requiredFlag(options.flags.source, '--source');
    const receipt = options.flags.receipt
      ? await readReceipt(options.flags.receipt)
      : undefined;
    const report = purpose === 'lookbook.image'
      ? await service.importLookbookImageMedia({
          projectName: options.flags.project,
          homeDir: options.homeDir,
          lookbookId: parseLookbookTarget(target),
          sourceProjectRelativePath,
          title: options.flags.title,
          oneLineSummary: options.flags.summary,
          sections: parseSections(options.flags.sections),
          receipt,
        })
      : purpose === 'cast.character-sheet'
        ? await service.importCastCharacterSheetMedia({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            castMemberId: parseCastTarget(target),
            sourceProjectRelativePath,
            title: options.flags.title,
            oneLineSummary: options.flags.summary,
            receipt,
          })
        : purpose === 'cast.profile'
          ? await service.importCastProfileMedia({
              projectName: options.flags.project,
              homeDir: options.homeDir,
              castMemberId: parseCastTarget(target),
              sourceProjectRelativePath,
              title: options.flags.title,
              oneLineSummary: options.flags.summary,
              receipt,
            })
          : unsupportedMediaPurpose(purpose);
    await appendMediaResourceChangedEvent({
      options,
      report,
      command: 'media import',
    });
    writeJson(options.io, report);
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

function parseLookbookTarget(target: string): string {
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

function parseCastTarget(target: string): string {
  const [kind, id, extra] = target.split(':');
  if (kind !== 'cast' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Cast image import target must use cast:<id>. Received: ${target}.`,
      suggestion: 'Use --target cast:<cast-member-id>.',
    });
  }
  return id;
}

function unsupportedMediaPurpose(purpose: string): never {
  throw new StructuredError({
    code: 'CLI024',
    message: `Unsupported media import purpose: ${purpose}.`,
    suggestion:
      'Use --purpose lookbook.image, --purpose cast.character-sheet, or --purpose cast.profile.',
  });
}

function parseSections(value: string | undefined): string[] | undefined {
  return value
    ?.split(',')
    .map((section) => section.trim())
    .filter(Boolean);
}

async function appendMediaResourceChangedEvent(input: {
  options: {
    json: boolean;
    io: RenkuCliIo;
    homeDir?: string;
  };
  report: LookbookImageMediaImportReport | CastMediaImportReport;
  command: string;
}): Promise<void> {
  if (input.report.resourceKeys.length === 0) {
    return;
  }

  try {
    const coordination = createStudioCoordinationService({
      homeDir: input.options.homeDir,
    });
    await coordination.appendStudioEvent({
      type: 'studio.projectResourcesChanged',
      projectRef: await toProjectRef(input.report.project, input.options.homeDir),
      resourceKeys: input.report.resourceKeys,
      source: { kind: 'cli', command: input.command },
      operationId: createStudioOperationId(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Studio coordination event could not be appended.';
    if (input.options.json) {
      input.options.io.stderr.error(
        JSON.stringify(
          {
            warnings: [
              {
                code: 'CLI026',
                message:
                  'Media import succeeded, but Studio refresh coordination failed.',
                detail: message,
              },
            ],
          },
          null,
          2
        )
      );
      return;
    }
    input.options.io.stderr.error(
      `[CLI026] WARNING Media import succeeded, but Studio refresh coordination failed: ${message}`
    );
  }
}

async function toProjectRef(
  project: (LookbookImageMediaImportReport | CastMediaImportReport)['project'],
  homeDir?: string
): Promise<StudioProjectRef> {
  return {
    name: project.name,
    id: project.id ?? project.name,
    storageRoot: await resolveRenkuStorageRoot({ homeDir }),
  };
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
