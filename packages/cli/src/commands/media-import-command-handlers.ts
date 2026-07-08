import {
  type CastMediaImportReport,
  type LocationEnvironmentSheetMediaImportReport,
  type LocationHeroMediaImportReport,
  type LookbookImageMediaImportReport,
  type LookbookSheetMediaImportReport,
  type ReferenceImageMediaImportReport,
  type SceneStoryboardImagesImportReport,
  type ShotVideoTakeInputMediaImportReport,
  type ShotVideoTakeMediaImportReport,
  createStudioOperationId,
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
  appendStudioFocusRequestedEvent,
  appendStudioResourceChangedEvent,
  type StudioResourceChangedReport,
} from './studio-resource-event-command.js';
import {
  parseAssetTarget,
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
  kind?: string;
  selection?: string;
  replaceSelected?: boolean;
}

type MediaImportReport =
  | LookbookImageMediaImportReport
  | LookbookSheetMediaImportReport
  | CastMediaImportReport
  | ReferenceImageMediaImportReport
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
    const operationId = createStudioOperationId();
    await appendStudioResourceChangedEvent({
      runtime,
      report: report as StudioResourceChangedReport,
      command: 'media import',
      operationId,
    });
    await appendShotVideoTakeFocusRequest({
      runtime,
      report,
      operationId,
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
    purpose: 'reference.image',
    run: importReferenceImage,
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
    purpose: 'shot.input',
    run: importShotInput,
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

async function importReferenceImage(
  input: MediaImportPurposeHandlerInput
): Promise<ReferenceImageMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  return input.runtime.projectDataService.importReferenceImageMedia({
    ...mediaImportProjectInput(input.runtime),
    target: parseAssetTarget(input.target, 'Reference image import'),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    oneLineSummary: input.flags.summary,
    referenceName: optionalTrimmed(input.flags.referenceName),
    referencePurpose: optionalTrimmed(input.flags.referencePurpose),
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

async function importShotInput(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  return importShotInputMedia(input);
}

async function importShotVideoTake(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  const target = await resolveShotMediaTarget(input);
  return input.runtime.projectDataService.importShotVideoTake({
    ...mediaImportProjectInput(input.runtime),
    sceneId: target.sceneId,
    takeId: target.takeId,
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    receipt: singleFile.receipt,
  });
}

async function appendShotVideoTakeFocusRequest(input: {
  runtime: CliCommandRuntime;
  report: MediaImportReport;
  operationId: string;
}): Promise<void> {
  if (!isShotVideoTakeMediaImportReport(input.report)) {
    return;
  }
  await appendStudioFocusRequestedEvent({
    runtime: input.runtime,
    project: input.report.project,
    command: 'media import',
    operationId: input.operationId,
    selection: {
      type: 'scene',
      id: input.report.take.sceneId,
      sceneTab: 'takes',
      takeWorkspaceMode: 'edit',
      takeId: input.report.take.takeId,
      ...(input.report.take.shotIds[0]
        ? { shotId: input.report.take.shotIds[0], shotTab: 'ai-production' }
        : {}),
    },
  });
}

function isShotVideoTakeMediaImportReport(
  report: MediaImportReport
): report is ShotVideoTakeMediaImportReport {
  return report.purpose === 'shot.video-take';
}

async function importShotInputMedia(
  input: MediaImportPurposeHandlerInput
): Promise<ShotVideoTakeInputMediaImportReport> {
  const singleFile = await readSingleFileImport(input.flags);
  const target = await resolveShotMediaTarget(input);
  return input.runtime.projectDataService.importShotInputMedia({
    ...mediaImportProjectInput(input.runtime),
    sceneId: target.sceneId,
    takeId: target.takeId,
    inputKind: parseShotInputKind(input.flags.kind),
    sourceProjectRelativePath: singleFile.sourceProjectRelativePath,
    title: input.flags.title,
    receipt: singleFile.receipt,
    selection: parseSelection(input.flags.selection),
    replaceSelected: input.flags.replaceSelected,
  });
}

async function resolveShotMediaTarget(input: MediaImportPurposeHandlerInput): Promise<{
  sceneId: string;
  takeId: string;
}> {
  const takeId = parseTakeTarget(input.target);
  if (!takeId) {
    return {
      sceneId: parseSceneTarget(input.target, 'Shot Video Take media import'),
      takeId: requiredFlag(input.flags.take, '--take'),
    };
  }
  assertTakeTargetMatchesFlag({
    targetTakeId: takeId,
    flagTakeId: input.flags.take,
  });
  const take = await input.runtime.projectDataService.readSceneShotVideoTake({
    ...mediaImportProjectInput(input.runtime),
    takeId,
  });
  return {
    sceneId: take.sceneId,
    takeId: take.takeId,
  };
}

function parseTakeTarget(value: string): string | null {
  const [kind, id, extra] = value.split(':');
  if (kind !== 'take') {
    return null;
  }
  if (!id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI141',
      message: `Shot Video Take target must use take:<take-id>. Received: ${value}.`,
      suggestion: 'Use --target take:<take-id>.',
    });
  }
  return id;
}

function assertTakeTargetMatchesFlag(input: {
  targetTakeId: string;
  flagTakeId?: string;
}): void {
  if (input.flagTakeId && input.flagTakeId !== input.targetTakeId) {
    throw new StructuredError({
      code: 'CLI142',
      message: `--target take:${input.targetTakeId} conflicts with --take ${input.flagTakeId}.`,
      suggestion:
        'Omit --take when using --target take:<take-id>, or pass the same take id in both flags.',
    });
  }
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
      'Use --purpose lookbook.image, --purpose lookbook.sheet, --purpose cast.character-sheet, --purpose cast.profile, --purpose reference.image, --purpose location.environment-sheet, --purpose location.hero, --purpose scene.storyboard-sheet, --purpose shot.input, or --purpose shot.video-take.',
  });
}

function parseShotInputKind(value: string | undefined) {
  const kind = requiredFlag(value, '--kind');
  if (
    kind === 'first-frame' ||
    kind === 'last-frame' ||
    kind === 'reference-image' ||
    kind === 'video-prompt-sheet'
  ) {
    return kind;
  }
  throw new StructuredError({
    code: 'CLI149',
    message: `Unsupported shot input kind: ${kind}.`,
    suggestion:
      'Use --kind first-frame, --kind last-frame, --kind reference-image, or --kind video-prompt-sheet with --purpose shot.input.',
  });
}
