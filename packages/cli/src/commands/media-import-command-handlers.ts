import {
  type CastMediaImportReport,
  type LocationEnvironmentSheetMediaImportReport,
  type LookbookImageMediaImportReport,
  type LookbookSheetMediaImportReport,
  type SceneStoryboardSheetImportReport,
  type ShotVideoTakeInputMediaImportReport,
  type ShotVideoTakeMediaImportReport,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import {
  readLocationEnvironmentSheetImportDocument,
  readReceipt,
  readSceneStoryboardSheetImportDocument,
} from './media-import-documents.js';
import {
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';
import {
  parseCastTarget,
  parseLocationTarget,
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
  sections?: string;
  receipt?: string;
  shotList?: string;
  shots?: string;
  selection?: string;
}

type MediaImportReport =
  | LookbookImageMediaImportReport
  | LookbookSheetMediaImportReport
  | CastMediaImportReport
  | LocationEnvironmentSheetMediaImportReport
  | SceneStoryboardSheetImportReport
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
    purpose: 'shot.reference-sheet',
    run: importShotReferenceSheet,
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
  return input.runtime.projectDataService.importCastCharacterSheetMedia({
    ...mediaImportProjectInput(input.runtime),
    castMemberId: parseCastTarget(input.target, 'Cast image import'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    oneLineSummary: input.flags.summary,
    receipt: singleFile.receipt,
  });
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
  rejectGroupedImportSourceAndReceipt(input.flags, {
    sourceMessage: 'Location environment sheet import does not accept --source.',
    sourceSuggestion:
      'Use --file with a JSON document that lists composite, view_front, view_right, view_back, and view_left.',
    receiptMessage:
      'Location environment sheet import does not accept --receipt.',
    receiptSuggestion:
      'The generation receipt stays with the composite generation run; import only the grouped image files.',
  });
  const document = await readLocationEnvironmentSheetImportDocument(
    requiredFlag(input.flags.file, '--file')
  );
  return input.runtime.projectDataService.importLocationEnvironmentSheetMedia({
    ...mediaImportProjectInput(input.runtime),
    locationId: parseLocationTarget(
      input.target,
      'Location environment sheet import'
    ),
    files: document.files,
    title: input.flags.title ?? document.title,
    oneLineSummary: input.flags.summary ?? document.oneLineSummary,
  });
}

async function importSceneStoryboardSheet(
  input: MediaImportPurposeHandlerInput
): Promise<SceneStoryboardSheetImportReport> {
  rejectGroupedImportSourceAndReceipt(input.flags, {
    sourceMessage: 'Scene storyboard sheet import does not accept --source.',
    sourceSuggestion:
      'Use --file with a JSON document that lists the original sheet and one sliced image per shot.',
    receiptMessage: 'Scene storyboard sheet import does not accept --receipt.',
    receiptSuggestion:
      'The generation receipt stays with the storyboard sheet generation run; import only the grouped image files.',
  });
  const document = await readSceneStoryboardSheetImportDocument(
    requiredFlag(input.flags.file, '--file')
  );
  return input.runtime.projectDataService.importSceneStoryboardSheetMedia({
    ...mediaImportProjectInput(input.runtime),
    sceneId: parseSceneTarget(input.target, 'Scene storyboard sheet import'),
    shotListId: requiredFlag(input.flags.shotList, '--shot-list'),
    document,
    title: input.flags.title ?? document.title ?? document.sheets?.[0]?.title,
  });
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

async function importShotReferenceSheet(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  return importShotInputMedia(input, (shotInput) =>
    input.runtime.projectDataService.importShotReferenceSheet(shotInput)
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
    sceneId: parseSceneTarget(input.target, 'Shot video take import'),
    shotListId: requiredFlag(input.flags.shotList, '--shot-list'),
    shotIds: parseShots(requiredFlag(input.flags.shots, '--shots')),
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
    sceneId: parseSceneTarget(input.target, 'Shot input media import'),
    shotListId: requiredFlag(input.flags.shotList, '--shot-list'),
    shotIds: parseShots(requiredFlag(input.flags.shots, '--shots')),
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

function rejectGroupedImportSourceAndReceipt(
  flags: MediaCommandFlags,
  messages: {
    sourceMessage: string;
    sourceSuggestion: string;
    receiptMessage: string;
    receiptSuggestion: string;
  }
): void {
  if (flags.source) {
    throw new StructuredError({
      code: 'CLI027',
      message: messages.sourceMessage,
      suggestion: messages.sourceSuggestion,
    });
  }
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

function unsupportedMediaPurpose(purpose: string): StructuredError {
  return new StructuredError({
    code: 'CLI024',
    message: `Unsupported media import purpose: ${purpose}.`,
    suggestion:
      'Use --purpose lookbook.image, --purpose lookbook.sheet, --purpose cast.character-sheet, --purpose cast.profile, --purpose location.environment-sheet, --purpose scene.storyboard-sheet, --purpose shot.first-frame, --purpose shot.last-frame, --purpose shot.reference-sheet, --purpose shot.multi-shot-storyboard-sheet, or --purpose shot.video-take.',
  });
}
