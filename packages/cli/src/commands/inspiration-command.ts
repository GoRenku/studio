import fs from 'node:fs/promises';
import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import {
  createProjectDataService,
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
  type InspirationAnalysisDocument,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runInspirationCommand(options: {
  input: string[];
  flags: {
    file?: string;
    folder?: string;
    name?: string;
    project?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [action, nested] = options.input;
  const service = createProjectDataService();
  const projectName = options.flags.project;

  if (action === 'list') {
    writeJson(
      options.io,
      await service.listInspirationFolders({
        projectName,
        homeDir: options.homeDir,
      })
    );
    return 0;
  }

  if (action === 'create') {
    writeJson(
      options.io,
      await service.createInspirationFolder({
        projectName,
        homeDir: options.homeDir,
        name: requiredFlag(options.flags.name, '--name'),
      })
    );
    return 0;
  }

  if (action === 'show') {
    writeJson(
      options.io,
      await service.readInspirationAnalysis({
        projectName,
        homeDir: options.homeDir,
        folderId: requiredFlag(options.flags.folder, '--folder'),
      })
    );
    return 0;
  }

  if (action === 'rename') {
    writeJson(
      options.io,
      await service.renameInspirationFolder({
        projectName,
        homeDir: options.homeDir,
        folderId: requiredFlag(options.flags.folder, '--folder'),
        name: requiredFlag(options.flags.name, '--name'),
      })
    );
    return 0;
  }

  if (action === 'reorder') {
    const input = await readJsonInput(requiredFlag(options.flags.file, '--file'));
    const folderIds = readFolderIds(input);
    writeJson(
      options.io,
      await service.reorderInspirationFolders({
        projectName,
        homeDir: options.homeDir,
        folderIds,
      })
    );
    return 0;
  }

  if (action === 'delete') {
    await service.deleteInspirationFolder({
      projectName,
      homeDir: options.homeDir,
      folderId: requiredFlag(options.flags.folder, '--folder'),
    });
    writeJson(options.io, { ok: true });
    return 0;
  }

  if (action === 'analysis' && nested === 'show') {
    writeJson(
      options.io,
      await service.readInspirationAnalysis({
        projectName,
        homeDir: options.homeDir,
        folderId: requiredFlag(options.flags.folder, '--folder'),
      })
    );
    return 0;
  }

  if (action === 'analysis' && nested === 'validate') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readJsonInput(filePath);
    writeJson(
      options.io,
      await service.validateInspirationAnalysis({
        projectName,
        homeDir: options.homeDir,
        folderId: requiredFlag(options.flags.folder, '--folder'),
        document: document as InspirationAnalysisDocument,
        filePath: filePath !== '-' ? filePath : undefined,
      })
    );
    return 0;
  }

  if (action === 'analysis' && nested === 'write') {
    const filePath = requiredFlag(options.flags.file, '--file');
    const document = await readJsonInput(filePath);
    const report = await service.writeInspirationAnalysis({
      projectName,
      homeDir: options.homeDir,
      folderId: requiredFlag(options.flags.folder, '--folder'),
      document: document as InspirationAnalysisDocument,
      filePath: filePath !== '-' ? filePath : undefined,
    });
    await appendInspirationResourceChangedEvent({
      options,
      projectName: report.project.name,
      projectId: report.project.id,
      resourceKeys: report.resourceKeys,
      command: 'inspiration analysis write',
    });
    writeJson(options.io, report);
    return 0;
  }

  throw new StructuredError({
    code: 'CLI092',
    message: 'Unknown inspiration command.',
    issues: [
      createDiagnosticError(
        'CLI092',
        'Unknown inspiration command.',
        { path: ['inspiration', action ?? '', nested ?? ''] },
        'Use list/create/show/rename/reorder/delete or analysis show/validate/write.'
      ),
    ],
    suggestion: 'Use a supported inspiration command.',
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

function readFolderIds(input: unknown): string[] {
  const folderIds = Array.isArray(input)
    ? input
    : input && typeof input === 'object'
      ? (input as { folderIds?: unknown }).folderIds
      : undefined;
  if (
    !Array.isArray(folderIds) ||
    folderIds.some((folderId) => typeof folderId !== 'string')
  ) {
    throw new StructuredError({
      code: 'CLI094',
      message: 'Inspiration reorder input must contain folder IDs.',
      issues: [
        createDiagnosticError(
          'CLI094',
          'Inspiration reorder input must be an array of folder IDs or an object with folderIds.',
          { path: ['--file'] },
          'Provide `["folder_id"]` or `{ "folderIds": ["folder_id"] }`.'
        ),
      ],
      suggestion: 'Provide an ordered list of every Inspiration folder ID.',
    });
  }
  return folderIds;
}

async function appendInspirationResourceChangedEvent(input: {
  options: {
    json: boolean;
    io: RenkuCliIo;
    homeDir?: string;
  };
  projectName: string;
  projectId?: string;
  resourceKeys: string[];
  command: string;
}): Promise<void> {
  if (input.resourceKeys.length === 0) {
    return;
  }

  try {
    const coordination = createStudioCoordinationService({
      homeDir: input.options.homeDir,
    });
    await coordination.appendStudioEvent({
      type: 'studio.projectResourcesChanged',
      projectRef: await toProjectRef(input, input.options.homeDir),
      resourceKeys: input.resourceKeys,
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
                code: 'CLI093',
                message:
                  'Inspiration mutation succeeded, but Studio refresh coordination failed.',
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
      `[CLI093] WARNING Inspiration mutation succeeded, but Studio refresh coordination failed: ${message}`
    );
  }
}

async function toProjectRef(
  input: { projectName: string; projectId?: string },
  homeDir?: string
): Promise<StudioProjectRef> {
  return {
    name: input.projectName,
    id: input.projectId ?? input.projectName,
    storageRoot: await resolveRenkuStorageRoot({ homeDir }),
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
