import {
  type CastMediaImportReport,
  type LocationEnvironmentSheetMediaImportReport,
  type LocationHeroMediaImportReport,
  type LookbookImageMediaImportReport,
  type LookbookSheetMediaImportReport,
  type SceneStoryboardImagesImportReport,
  type ShotVideoTakeInputMediaImportReport,
  type ShotVideoTakeMediaImportReport,
} from '@gorenku/studio-core/server';
import {
  StructuredError,
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import {
  readReceipt,
  readSceneStoryboardImagesImportDocument,
} from './media-import-documents.js';
import {
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';
import {
  parseCastTarget,
  parseLocationTarget,
  parseAnchor,
  parseLookbookTarget,
  parseSceneTarget,
  parseSections,
  parseSelection,
  parseShots,
} from './studio-target-parsing.js';
import {
  requiredFlag,
  type CliCommandHandler,
  type CliCommandRuntime,
} from './structured-command.js';

export interface MediaCommandFlags {
  project?: string;
  purpose?: string;
  target?: string;
  file?: string;
  source?: string;
  title?: string;
  summary?: string;
  referenceName?: string;
  referencePurpose?: string;
  sections?: string;
  anchor?: string;
  receipt?: string;
  sourceSheet?: string;
  shotList?: string;
  shots?: string;
  take?: string;
  selection?: string;
}

type MediaImportReport =
  | LookbookImageMediaImportReport
  | LookbookSheetMediaImportReport
  | CastMediaImportReport
  | LocationEnvironmentSheetMediaImportReport
  | LocationHeroMediaImportReport
  | SceneStoryboardImagesImportReport
  | ShotVideoTakeInputMediaImportReport
  | ShotVideoTakeMediaImportReport;

interface MediaImportPurposeHandler {
  purpose: string;
  run(input: MediaImportPurposeHandlerInput): Promise<MediaImportReport>;
}

interface MediaImportPurposeHandlerInput {
  flags: MediaCommandFlags;
  runtime: CliCommandRuntime;
  target: string;
}

export const mediaImportCommandHandler: CliCommandHandler<MediaCommandFlags> = {
  path: ['import'],
  async run({ flags, runtime }) {
    const purpose = requiredFlag(flags.purpose, '--purpose');
    const target = requiredFlag(flags.target, '--target');
    const report = await requireMediaImportPurposeHandler(purpose).run({
      flags,
      runtime,
      target,
    });
    await appendStudioResourceChangedEvent({
      runtime,
      report: report as StudioResourceChangedReport,
      command: 'media import',
    });
    return report;
  },
};

const MEDIA_IMPORT_PURPOSE_HANDLERS = [
  {
    purpose: 'lookbook.image',
    run: importLookbookImage,
  },
  {
    purpose: 'lookbook.sheet',
    run: importLookbookSheet,
  },
  {
    purpose: 'cast.character-sheet',
    run: importCastCharacterSheet,
  },
  {
    purpose: 'cast.profile',
    run: importCastProfile,
  },
  {
    purpose: 'location.environment-sheet',
    run: importLocationEnvironmentSheet,
  },
  {
    purpose: 'location.hero',
    run: importLocationHero,
  },
  {
    purpose: 'scene.storyboard-sheet',
    run: importSceneStoryboardSheet,
  },
  {
    purpose: 'shot.first-frame',
    run: importShotFirstFrame,
  },
  {
    purpose: 'shot.last-frame',
    run: importShotLastFrame,
  },
  {
    purpose: 'shot.reference-image',
    run: importShotReferenceImage,
  },
  {
    purpose: 'shot.multi-shot-storyboard-sheet',
    run: importShotMultiShotStoryboardSheet,
  },
  {
    purpose: 'shot.video-take',
    run: importShotVideoTake,
  },
] satisfies MediaImportPurposeHandler[];

export function listMediaImportPurposeHandlers(): readonly MediaImportPurposeHandler[] {
  return MEDIA_IMPORT_PURPOSE_HANDLERS;
}

function requireMediaImportPurposeHandler(
  purpose: string
): MediaImportPurposeHandler {
  const handler = MEDIA_IMPORT_PURPOSE_HANDLERS.find(
    (candidate) => candidate.purpose === purpose
  );
  if (!handler) {
    throw unsupportedMediaPurpose(purpose);
  }
  return handler;
}

async function importLookbookImage(
  input: MediaImportPurposeHandlerInput
): Promise<LookbookImageMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return input.runtime.projectDataService.importLookbookImageMedia({
    ...mediaImportProjectInput(input.runtime),
    lookbookId: parseLookbookTarget(input.target, 'Lookbook image import'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    oneLineSummary: input.flags.summary,
    sections: parseSections(input.flags.sections),
    anchorPointId: parseAnchor(input.flags.anchor),
    receipt: singleFile.receipt,
  });
}

async function importLookbookSheet(
  input: MediaImportPurposeHandlerInput
): Promise<LookbookSheetMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return input.runtime.projectDataService.importLookbookSheetMedia({
    ...mediaImportProjectInput(input.runtime),
    lookbookId: parseLookbookTarget(input.target, 'Lookbook sheet import'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    oneLineSummary: input.flags.summary,
    receipt: singleFile.receipt,
  });
}

async function importCastCharacterSheet(
  input: MediaImportPurposeHandlerInput
): Promise<CastMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  const referenceName = requiredFlag(input.flags.referenceName, '--reference-name');
  const referencePurpose = optionalTrimmed(input.flags.referencePurpose);
  const report = await input.runtime.projectDataService.importCastCharacterSheetMedia({
    ...mediaImportProjectInput(input.runtime),
    castMemberId: parseCastTarget(input.target, 'Cast image import'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    oneLineSummary: input.flags.summary,
    referenceName,
    ...(referencePurpose ? { referencePurpose } : {}),
    receipt: singleFile.receipt,
  });
  if (!referencePurpose) {
    report.warnings.push(
      createDiagnosticWarning(
        'CLI045',
        'Missing optional --reference-purpose for cast character sheet import.',
        { path: ['--reference-purpose'], context: 'renku CLI arguments' },
        'Add a short purpose such as "main palace character sheet" when the usage context is known.'
      )
    );
  }
  return report;
}

async function importCastProfile(
  input: MediaImportPurposeHandlerInput
): Promise<CastMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return input.runtime.projectDataService.importCastProfileMedia({
    ...mediaImportProjectInput(input.runtime),
    castMemberId: parseCastTarget(input.target, 'Cast image import'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    oneLineSummary: input.flags.summary,
    receipt: singleFile.receipt,
  });
}

async function importLocationEnvironmentSheet(
  input: MediaImportPurposeHandlerInput
): Promise<LocationEnvironmentSheetMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return input.runtime.projectDataService.importLocationEnvironmentSheetMedia({
    ...mediaImportProjectInput(input.runtime),
    locationId: parseLocationTarget(
      input.target,
      'Location environment sheet import'
    ),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    description: requiredFlag(input.flags.summary, '--summary'),
    receipt: singleFile.receipt,
  });
}

async function importLocationHero(
  input: MediaImportPurposeHandlerInput
): Promise<LocationHeroMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return input.runtime.projectDataService.importLocationHeroMedia({
    ...mediaImportProjectInput(input.runtime),
    locationId: parseLocationTarget(input.target, 'Location hero import'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    sourceLocationSheetAssetId: requiredFlag(input.flags.sourceSheet, '--source-sheet'),
    title: input.flags.title,
    description: requiredFlag(input.flags.summary, '--summary'),
    receipt: singleFile.receipt,
  });
}

async function importSceneStoryboardSheet(
  input: MediaImportPurposeHandlerInput
): Promise<SceneStoryboardImagesImportReport> {
  rejectReceipt(input.flags, {
    receiptMessage: 'Scene storyboard image import does not accept --receipt.',
    receiptSuggestion:
      'The generation receipt stays with the temporary storyboard sheet run; import only cropped shot image files.',
  });
  const sceneId = parseSceneTarget(input.target, 'Scene storyboard image import');
  const shotListId = requiredFlag(input.flags.shotList, '--shot-list');
  if (input.flags.file && input.flags.source) {
    throw new StructuredError({
      code: 'CLI030',
      message: 'Scene storyboard image import cannot combine --file and --source.',
      suggestion:
        'Use --source plus --shots for one cropped image, or --file for multiple cropped images.',
    });
  }
  const document = input.flags.file
    ? await readSceneStoryboardImagesImportDocument(input.flags.file)
    : {
        kind: 'sceneStoryboardImagesImport' as const,
        shotListId,
        shots: [
          {
            shotId: parseSingleShot(input.flags.shots),
            source: requiredFlag(input.flags.source, '--source'),
            ...(input.flags.title ? { title: input.flags.title } : {}),
            sourcePurpose: 'scene.storyboard-sheet' as const,
          },
        ],
      };
  return input.runtime.projectDataService.importSceneStoryboardImagesMedia({
    ...mediaImportProjectInput(input.runtime),
    sceneId,
    shotListId,
    document,
    title: input.flags.title ?? document.title,
  });
}

function parseSingleShot(value: string | undefined): string {
  const shots = parseShots(requiredFlag(value, '--shots'));
  if (shots.length !== 1) {
    throw new StructuredError({
      code: 'CLI031',
      message: 'Single-source storyboard image import requires exactly one shot id.',
      suggestion:
        'Use --shots <shot-id> with --source, or use --file for multiple cropped images.',
    });
  }
  return shots[0]!;
}

async function importShotFirstFrame(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  return importShotInputMedia(input, (shotInput) =>
    input.runtime.projectDataService.importShotFirstFrame(shotInput)
  );
}

async function importShotLastFrame(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  return importShotInputMedia(input, (shotInput) =>
    input.runtime.projectDataService.importShotLastFrame(shotInput)
  );
}

async function importShotReferenceImage(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  return importShotInputMedia(input, (shotInput) =>
    input.runtime.projectDataService.importShotReferenceImage(shotInput)
  );
}

async function importShotMultiShotStoryboardSheet(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  return importShotInputMedia(input, (shotInput) =>
    input.runtime.projectDataService.importShotMultiShotStoryboardSheet(shotInput)
  );
}

async function importShotVideoTake(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return input.runtime.projectDataService.importShotVideoTake({
    ...mediaImportProjectInput(input.runtime),
    sceneId: parseSceneTarget(input.target, 'Shot Video Take media import'),
    takeId: requiredFlag(input.flags.take, '--take'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    receipt: singleFile.receipt,
  });
}

async function importShotInputMedia(
  input: MediaImportPurposeHandlerInput,
  importMedia: (
    shotInput: Parameters<
      CliCommandRuntime['projectDataService']['importShotFirstFrame']
    >[0]
  ) => Promise<ShotVideoTakeInputMediaImportReport>
): Promise<ShotVideoTakeInputMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return importMedia({
    ...mediaImportProjectInput(input.runtime),
    sceneId: parseSceneTarget(input.target, 'Shot Video Take input import'),
    takeId: requiredFlag(input.flags.take, '--take'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    receipt: singleFile.receipt,
    selection: parseSelection(input.flags.selection),
  });
}

async function readSingleFileImport(flags: MediaCommandFlags): Promise<{
  sourceProjectRelativePath: string;
  receipt?: unknown;
}> {
  return {
    sourceProjectRelativePath: requiredFlag(flags.source, '--source'),
    ...(flags.receipt ? { receipt: await readReceipt(flags.receipt) } : {}),
  };
}

function rejectReceipt(
  flags: MediaCommandFlags,
  messages: {
    receiptMessage: string;
    receiptSuggestion: string;
  }
): void {
  if (flags.receipt) {
    throw new StructuredError({
      code: 'CLI028',
      message: messages.receiptMessage,
      suggestion: messages.receiptSuggestion,
    });
  }
}

function mediaImportProjectInput(runtime: CliCommandRuntime): {
  projectName?: string;
  homeDir?: string;
} {
  return {
    projectName: runtime.projectName,
    homeDir: runtime.homeDir,
  };
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function unsupportedMediaPurpose(purpose: string): StructuredError {
  return new StructuredError({
    code: 'CLI024',
    message: `Unsupported media import purpose: ${purpose}.`,
    suggestion:
      'Use --purpose lookbook.image, --purpose lookbook.sheet, --purpose cast.character-sheet, --purpose cast.profile, --purpose location.environment-sheet, --purpose location.hero, --purpose scene.storyboard-sheet, --purpose shot.first-frame, --purpose shot.last-frame, --purpose shot.reference-image, --purpose shot.multi-shot-storyboard-sheet, or --purpose shot.video-take.',
  });
}
