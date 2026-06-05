import fs from 'node:fs/promises';
import {
  createProjectDataService,
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
  type CastMediaImportReport,
  type LocationEnvironmentSheetMediaImportReport,
  type LookbookImageMediaImportReport,
  type LookbookSheetMediaImportReport,
  type SceneStoryboardSheetImportDocument,
  type SceneStoryboardSheetImportReport,
  type ShotVideoTakeInputMediaImportReport,
  type ShotVideoTakeMediaImportReport,
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
    file?: string;
    source?: string;
    title?: string;
    summary?: string;
    sections?: string;
    receipt?: string;
    shotList?: string;
    shots?: string;
    selection?: string;
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
    let report:
      | LookbookImageMediaImportReport
      | LookbookSheetMediaImportReport
      | CastMediaImportReport
      | LocationEnvironmentSheetMediaImportReport
      | SceneStoryboardSheetImportReport
      | ShotVideoTakeInputMediaImportReport
      | ShotVideoTakeMediaImportReport;

    if (purpose === 'location.environment-sheet') {
      if (options.flags.source) {
        throw new StructuredError({
          code: 'CLI027',
          message: 'Location environment sheet import does not accept --source.',
          suggestion:
            'Use --file with a JSON document that lists composite, view_front, view_right, view_back, and view_left.',
        });
      }
      if (options.flags.receipt) {
        throw new StructuredError({
          code: 'CLI028',
          message:
            'Location environment sheet import does not accept --receipt.',
          suggestion:
            'The generation receipt stays with the composite generation run; import only the grouped image files.',
        });
      }
      const document = await readLocationEnvironmentSheetImportDocument(
        requiredFlag(options.flags.file, '--file')
      );
      report = await service.importLocationEnvironmentSheetMedia({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        locationId: parseLocationTarget(target),
        files: document.files,
        title: options.flags.title ?? document.title,
        oneLineSummary: options.flags.summary ?? document.oneLineSummary,
      });
    } else if (purpose === 'scene.storyboard-sheet') {
      if (options.flags.source) {
        throw new StructuredError({
          code: 'CLI027',
          message: 'Scene storyboard sheet import does not accept --source.',
          suggestion:
            'Use --file with a JSON document that lists the original sheet and one sliced image per shot.',
        });
      }
      if (options.flags.receipt) {
        throw new StructuredError({
          code: 'CLI028',
          message: 'Scene storyboard sheet import does not accept --receipt.',
          suggestion:
            'The generation receipt stays with the storyboard sheet generation run; import only the grouped image files.',
        });
      }
      const document = await readSceneStoryboardSheetImportDocument(
        requiredFlag(options.flags.file, '--file')
      );
      report = await service.importSceneStoryboardSheetMedia({
        projectName: options.flags.project,
        homeDir: options.homeDir,
        sceneId: parseSceneTarget(target),
        shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
        document,
        title:
          options.flags.title ??
          document.title ??
          document.sheets?.[0]?.title,
      });
    } else {
      const sourceProjectRelativePath = requiredFlag(
        options.flags.source,
        '--source'
      );
      const receipt = options.flags.receipt
        ? await readReceipt(options.flags.receipt)
        : undefined;
      switch (purpose) {
        case 'lookbook.image':
          report = await service.importLookbookImageMedia({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            lookbookId: parseLookbookTarget(target),
            sourceProjectRelativePath,
            title: options.flags.title,
            oneLineSummary: options.flags.summary,
            sections: parseSections(options.flags.sections),
            receipt,
          });
          break;
        case 'lookbook.sheet':
          report = await service.importLookbookSheetMedia({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            lookbookId: parseLookbookTarget(target),
            sourceProjectRelativePath,
            title: options.flags.title,
            oneLineSummary: options.flags.summary,
            receipt,
          });
          break;
        case 'cast.character-sheet':
          report = await service.importCastCharacterSheetMedia({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            castMemberId: parseCastTarget(target),
            sourceProjectRelativePath,
            title: options.flags.title,
            oneLineSummary: options.flags.summary,
            receipt,
          });
          break;
        case 'cast.profile':
          report = await service.importCastProfileMedia({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            castMemberId: parseCastTarget(target),
            sourceProjectRelativePath,
            title: options.flags.title,
            oneLineSummary: options.flags.summary,
            receipt,
          });
          break;
        case 'shot.first-frame':
          report = await service.importShotFirstFrame({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            sceneId: parseSceneTarget(target),
            shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
            shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
            sourceProjectRelativePath,
            title: options.flags.title,
            receipt,
            selection: parseSelection(options.flags.selection),
          });
          break;
        case 'shot.last-frame':
          report = await service.importShotLastFrame({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            sceneId: parseSceneTarget(target),
            shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
            shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
            sourceProjectRelativePath,
            title: options.flags.title,
            receipt,
            selection: parseSelection(options.flags.selection),
          });
          break;
        case 'shot.reference-sheet':
          report = await service.importShotReferenceSheet({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            sceneId: parseSceneTarget(target),
            shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
            shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
            sourceProjectRelativePath,
            title: options.flags.title,
            receipt,
            selection: parseSelection(options.flags.selection),
          });
          break;
        case 'shot.multi-shot-storyboard-sheet':
          report = await service.importShotMultiShotStoryboardSheet({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            sceneId: parseSceneTarget(target),
            shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
            shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
            sourceProjectRelativePath,
            title: options.flags.title,
            receipt,
            selection: parseSelection(options.flags.selection),
          });
          break;
        case 'shot.video-take':
          report = await service.importShotVideoTake({
            projectName: options.flags.project,
            homeDir: options.homeDir,
            sceneId: parseSceneTarget(target),
            shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
            shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
            sourceProjectRelativePath,
            title: options.flags.title,
            receipt,
          });
          break;
        default:
          report = unsupportedMediaPurpose(purpose);
      }
    }
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

async function readLocationEnvironmentSheetImportDocument(filePath: string): Promise<{
  title?: string;
  oneLineSummary?: string;
  files: {
    composite: string;
    view_front: string;
    view_right: string;
    view_back: string;
    view_left: string;
  };
}> {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw invalidLocationEnvironmentSheetImportFile(filePath);
  }
  const files = parsed.files;
  if (!isRecord(files)) {
    throw invalidLocationEnvironmentSheetImportFile(filePath);
  }
  const composite = readLocationEnvironmentSheetImportFileRole(
    files,
    filePath,
    'composite'
  );
  const viewFront = readLocationEnvironmentSheetImportFileRole(
    files,
    filePath,
    'view_front'
  );
  const viewRight = readLocationEnvironmentSheetImportFileRole(
    files,
    filePath,
    'view_right'
  );
  const viewBack = readLocationEnvironmentSheetImportFileRole(
    files,
    filePath,
    'view_back'
  );
  const viewLeft = readLocationEnvironmentSheetImportFileRole(
    files,
    filePath,
    'view_left'
  );
  return {
    ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
    ...(typeof parsed.oneLineSummary === 'string'
      ? { oneLineSummary: parsed.oneLineSummary }
      : {}),
    files: {
      composite,
      view_front: viewFront,
      view_right: viewRight,
      view_back: viewBack,
      view_left: viewLeft,
    },
  };
}

async function readSceneStoryboardSheetImportDocument(
  filePath: string
): Promise<SceneStoryboardSheetImportDocument> {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed) || parsed.kind !== 'sceneStoryboardSheetImport') {
    throw invalidSceneStoryboardSheetImportFile(filePath);
  }
  const sheets = parsed.sheets;
  if (!Array.isArray(sheets)) {
    throw invalidSceneStoryboardSheetImportFile(filePath);
  }
  return {
    kind: 'sceneStoryboardSheetImport',
    ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
    sheets: sheets.map((sheet) => {
      if (!isRecord(sheet) || typeof sheet.source !== 'string') {
        throw invalidSceneStoryboardSheetImportFile(filePath);
      }
      const shots = sheet.shots;
      if (!Array.isArray(shots)) {
        throw invalidSceneStoryboardSheetImportFile(filePath);
      }
      return {
        source: sheet.source,
        ...(typeof sheet.title === 'string' ? { title: sheet.title } : {}),
        shots: shots.map((shot) => {
          if (
            !isRecord(shot) ||
            typeof shot.shotId !== 'string' ||
            typeof shot.source !== 'string'
          ) {
            throw invalidSceneStoryboardSheetImportFile(filePath);
          }
          return {
            shotId: shot.shotId,
            source: shot.source,
            ...(typeof shot.title === 'string' ? { title: shot.title } : {}),
          };
        }),
      };
    }),
  };
}

function readLocationEnvironmentSheetImportFileRole(
  files: Record<string, unknown>,
  filePath: string,
  role: 'composite' | 'view_front' | 'view_right' | 'view_back' | 'view_left'
): string {
  const value = files[role];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidLocationEnvironmentSheetImportFile(filePath);
  }
  return value;
}

function invalidLocationEnvironmentSheetImportFile(filePath: string): StructuredError {
  return new StructuredError({
    code: 'CLI029',
    message: `Invalid Location environment sheet import file: ${filePath}.`,
    suggestion:
      'Provide JSON with files.composite, files.view_front, files.view_right, files.view_back, and files.view_left.',
  });
}

function invalidSceneStoryboardSheetImportFile(filePath: string): StructuredError {
  return new StructuredError({
    code: 'CLI029',
    message: `Invalid Scene storyboard sheet import file: ${filePath}.`,
    suggestion:
      'Provide JSON with kind and sheets[] entries containing source plus shots[] with shotId and source.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function parseLocationTarget(target: string): string {
  const [kind, id, extra] = target.split(':');
  if (kind !== 'location' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Location image import target must use location:<id>. Received: ${target}.`,
      suggestion: 'Use --target location:<location-id>.',
    });
  }
  return id;
}

function parseSceneTarget(target: string): string {
  const [kind, id, extra] = target.split(':');
  if (kind !== 'scene' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Scene storyboard sheet import target must use scene:<id>. Received: ${target}.`,
      suggestion: 'Use --target scene:<scene-id>.',
    });
  }
  return id;
}

function parseShots(value: string): string[] {
  const shots = value
    .split(',')
    .map((shotId) => shotId.trim())
    .filter(Boolean);
  if (shots.length === 0) {
    throw new StructuredError({
      code: 'CLI030',
      message: '--shots must include at least one shot id.',
      suggestion: 'Use --shots shot_001 or --shots shot_001,shot_002.',
    });
  }
  return shots;
}

function parseSelection(value: string | undefined): 'select' | 'take' | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'select' || value === 'take') {
    return value;
  }
  throw new StructuredError({
    code: 'CLI031',
    message: `Unsupported media import selection: ${value}.`,
    suggestion: 'Use --selection select or --selection take.',
  });
}

function unsupportedMediaPurpose(purpose: string): never {
  throw new StructuredError({
    code: 'CLI024',
    message: `Unsupported media import purpose: ${purpose}.`,
    suggestion:
      'Use --purpose lookbook.image, --purpose lookbook.sheet, --purpose cast.character-sheet, --purpose cast.profile, --purpose location.environment-sheet, --purpose scene.storyboard-sheet, --purpose shot.first-frame, --purpose shot.last-frame, --purpose shot.reference-sheet, --purpose shot.multi-shot-storyboard-sheet, or --purpose shot.video-take.',
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
  report:
    | LookbookImageMediaImportReport
    | LookbookSheetMediaImportReport
    | CastMediaImportReport
    | LocationEnvironmentSheetMediaImportReport
    | SceneStoryboardSheetImportReport
    | ShotVideoTakeInputMediaImportReport
    | ShotVideoTakeMediaImportReport;
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
  project: (
    | LookbookImageMediaImportReport
    | LookbookSheetMediaImportReport
    | CastMediaImportReport
    | LocationEnvironmentSheetMediaImportReport
    | SceneStoryboardSheetImportReport
    | ShotVideoTakeInputMediaImportReport
    | ShotVideoTakeMediaImportReport
  )['project'],
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
