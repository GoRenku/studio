import {
  StructuredError,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  type ProjectInformationPatch,
  type ProjectLanguagePatchOperation,
} from '@gorenku/studio-core/client';
import {
  createProjectDataService,
  createStudioCoordinationService,
  createStudioOperationId,
  resolveRenkuStorageRoot,
  type Project,
  type ProjectShell,
  type ProjectInformationRefreshField,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export interface RunProjectInformationCommandOptions {
  input: string[];
  flags: ProjectInformationFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}

export interface ProjectInformationFlags {
  project?: string;
  title?: string;
  aspectRatio?: string | boolean;
  logline?: string | boolean;
  synopsis?: string | boolean;
  premise?: string | boolean;
  intendedAudience?: string | boolean;
  format?: string | boolean;
  targetRuntimeMinutes?: string | boolean;
  primaryGenre?: string | boolean;
  secondaryGenres?: string | boolean;
  tones?: string | boolean;
  contentRatingIntent?: string | boolean;
  creativeBoundaries?: string | boolean;
  centralConflict?: string | boolean;
  dramaticQuestion?: string | boolean;
  themes?: string | boolean;
  historicalBasis?: string | boolean;
  dramatizedElements?: string | boolean;
  screenplayDraftStatus?: string | boolean;
  researchSources?: string | boolean;
  assumptions?: string | boolean;
  openQuestions?: string | boolean;
  nextSteps?: string | boolean;
  displayName?: string;
  base?: boolean;
  audio?: boolean;
  noAudio?: boolean;
  subtitles?: boolean;
  noSubtitles?: boolean;
}

export async function runProjectInformationCommand(
  options: RunProjectInformationCommandOptions
): Promise<number> {
  const [subcommand, ...rest] = options.input;
  if (subcommand === 'show') {
    return await showProjectInformation(options);
  }
  if (subcommand === 'set') {
    return await mutateProjectInformation(options, readSetPatch(options.flags));
  }
  if (subcommand === 'clear') {
    return await mutateProjectInformation(options, readClearPatch(options.flags));
  }
  if (subcommand === 'language') {
    return await runLanguageCommand({ ...options, input: rest });
  }
  throw new StructuredError({
    code: 'CLI020',
    message: 'Unknown info command. Usage: renku info show|set|clear|language ...',
    issues: [
      createDiagnosticError(
        'CLI020',
        'Unknown info command.',
        { path: ['info'], context: 'renku CLI arguments' },
        'Run renku info show, renku info set, renku info clear, or renku info language.'
      ),
    ],
  });
}

async function showProjectInformation(
  options: RunProjectInformationCommandOptions
): Promise<number> {
  const shell = await readTargetProject(options);
  const project = shell.project;
  const information = toProjectInformationOutput(shell);
  if (options.json) {
    options.io.stdout.log(JSON.stringify({ project: information }, null, 2));
  } else {
    options.io.stdout.log(`Project Information: ${project.projectName}`);
    options.io.stdout.log(`Title: ${project.title}`);
    options.io.stdout.log(`Aspect ratio: ${project.aspectRatio}`);
    options.io.stdout.log(`Logline: ${project.logline ?? 'not set'}`);
    options.io.stdout.log(`Synopsis: ${project.synopsis ?? 'not set'}`);
    options.io.stdout.log(`Premise: ${project.premise ?? 'not set'}`);
    options.io.stdout.log(`Format: ${project.format ?? 'not set'}`);
    options.io.stdout.log(`Target runtime: ${project.targetRuntimeMinutes ?? 'not set'}`);
    options.io.stdout.log(`Primary genre: ${project.primaryGenre ?? 'not set'}`);
    options.io.stdout.log(
      `Languages: ${shell.languages.map((language) => language.localeTag).join(', ')}`
    );
  }
  return 0;
}

async function mutateProjectInformation(
  options: RunProjectInformationCommandOptions,
  patch: ProjectInformationPatch
): Promise<number> {
  const projectName = await resolveTargetProjectName(options);
  const projectData = createProjectDataService();
  await projectData.patchProjectInformation({
    projectName,
    patch,
    homeDir: options.homeDir,
  });
  const shell = await projectData.readProjectShell({
    projectName,
    homeDir: options.homeDir,
  });
  const changedFields = changedProjectInformationFields(patch);
  await appendProjectInformationEvents({
    project: shell.project,
    changedFields,
    command: `renku info ${options.input[0]}`,
    homeDir: options.homeDir,
  });

  if (options.json) {
    options.io.stdout.log(
      JSON.stringify({ project: toProjectInformationOutput(shell), changedFields }, null, 2)
    );
  } else {
    options.io.stdout.log(`Project information updated: ${shell.project.projectName}`);
    options.io.stdout.log(`Changed: ${changedFields.join(', ')}`);
  }
  return 0;
}

async function runLanguageCommand(
  options: RunProjectInformationCommandOptions
): Promise<number> {
  const [languageCommand, localeTag] = options.input;
  if (!languageCommand || !localeTag) {
    throw new StructuredError({
      code: 'CLI021',
      message: 'Missing language command or locale tag.',
      issues: [
        createDiagnosticError(
          'CLI021',
          'Language commands require a locale tag.',
          { path: ['info', 'language'], context: 'renku CLI arguments' },
          'Use renku info language add <locale-tag>, update, remove, or set-base.'
        ),
      ],
    });
  }

  let operation: ProjectLanguagePatchOperation;
  if (languageCommand === 'add') {
    operation = {
      operation: 'add',
      localeTag,
      displayName: options.flags.displayName,
      isBase: options.flags.base ?? false,
      supportsAudio: options.flags.noAudio ? false : options.flags.audio ?? true,
      supportsSubtitles: options.flags.noSubtitles
        ? false
        : options.flags.subtitles ?? true,
    };
  } else if (languageCommand === 'update') {
    operation = {
      operation: 'update',
      localeTag,
      displayName: options.flags.displayName,
      isBase: options.flags.base,
      supportsAudio: options.flags.noAudio ? false : options.flags.audio,
      supportsSubtitles: options.flags.noSubtitles
        ? false
        : options.flags.subtitles,
    };
  } else if (languageCommand === 'remove') {
    operation = { operation: 'remove', localeTag };
  } else if (languageCommand === 'set-base') {
    operation = { operation: 'setBase', localeTag };
  } else {
    throw new StructuredError({
      code: 'CLI020',
      message: 'Unknown info language command.',
      issues: [
        createDiagnosticError(
          'CLI020',
          'Unknown info language command.',
          { path: ['info', 'language', languageCommand], context: 'renku CLI arguments' },
          'Use add, update, remove, or set-base.'
        ),
      ],
    });
  }

  return await mutateProjectInformation(
    { ...options, input: ['language', languageCommand, localeTag] },
    { languages: [operation] }
  );
}

async function readTargetProject(
  options: RunProjectInformationCommandOptions
): Promise<ProjectShell> {
  const projectName = await resolveTargetProjectName(options);
  return await createProjectDataService().readProjectShell({
    projectName,
    homeDir: options.homeDir,
  });
}

async function resolveTargetProjectName(
  options: RunProjectInformationCommandOptions
): Promise<string> {
  if (options.flags.project) {
    return options.flags.project;
  }
  const current = await createStudioCoordinationService({
    homeDir: options.homeDir,
  }).readStudioCurrent();
  if (current.project) {
    return current.project.name;
  }
  throw new StructuredError({
    code: 'CLI022',
    message: 'No current project is selected.',
    issues: [
      createDiagnosticError(
        'CLI022',
        'No current project is selected.',
        { path: ['--project'], context: 'renku CLI arguments' },
        'Run `renku project select <project-name>` or pass `--project <project-name>`.'
      ),
    ],
    suggestion:
      'Run `renku project select <project-name>` or pass `--project <project-name>`.',
  });
}

function readSetPatch(flags: ProjectInformationFlags): ProjectInformationPatch {
  const patch: ProjectInformationPatch = {};
  if (flags.title !== undefined) {
    patch.title = flags.title;
  }
  if (flags.aspectRatio !== undefined) {
    patch.aspectRatio = String(flags.aspectRatio);
  }
  if (flags.logline !== undefined) {
    patch.logline = String(flags.logline);
  }
  if (flags.synopsis !== undefined) {
    patch.synopsis = String(flags.synopsis);
  }
  assignSetProjectInformationFields(patch, flags);
  assertPatchHasFields(patch, 'renku info set');
  return patch;
}

function readClearPatch(flags: ProjectInformationFlags): ProjectInformationPatch {
  const patch: ProjectInformationPatch = {};
  if (flags.aspectRatio !== undefined) {
    patch.aspectRatio = null;
  }
  if (flags.logline !== undefined) {
    patch.logline = null;
  }
  if (flags.synopsis !== undefined) {
    patch.synopsis = null;
  }
  assignClearProjectInformationFields(patch, flags);
  assertPatchHasFields(patch, 'renku info clear');
  return patch;
}

function assertPatchHasFields(patch: ProjectInformationPatch, command: string): void {
  if (
    patch.title === undefined &&
    patch.aspectRatio === undefined &&
    patch.logline === undefined &&
    patch.synopsis === undefined &&
    patch.premise === undefined &&
    patch.intendedAudience === undefined &&
    patch.format === undefined &&
    patch.targetRuntimeMinutes === undefined &&
    patch.primaryGenre === undefined &&
    patch.secondaryGenres === undefined &&
    patch.tones === undefined &&
    patch.contentRatingIntent === undefined &&
    patch.creativeBoundaries === undefined &&
    patch.centralConflict === undefined &&
    patch.dramaticQuestion === undefined &&
    patch.themes === undefined &&
    patch.historicalBasis === undefined &&
    patch.dramatizedElements === undefined &&
    patch.screenplayDraftStatus === undefined &&
    patch.researchSources === undefined &&
    patch.assumptions === undefined &&
    patch.openQuestions === undefined &&
    patch.nextSteps === undefined &&
    patch.languages === undefined
  ) {
    throw new StructuredError({
      code: 'CLI023',
      message: `${command} did not include any fields to change.`,
      issues: [
        createDiagnosticError(
          'CLI023',
          'No project information fields were provided.',
          { path: [command], context: 'renku CLI arguments' },
          'Pass at least one project information flag.'
        ),
      ],
    });
  }
}

function changedProjectInformationFields(
  patch: ProjectInformationPatch
): ProjectInformationRefreshField[] {
  const fields: ProjectInformationRefreshField[] = [];
  if (patch.title !== undefined) {
    fields.push('title');
  }
  if (patch.aspectRatio !== undefined) {
    fields.push('aspectRatio');
  }
  if (patch.logline !== undefined) {
    fields.push('logline');
  }
  if (patch.synopsis !== undefined) {
    fields.push('synopsis');
  }
  for (const field of PROJECT_INFORMATION_OPTIONAL_FIELDS) {
    if (patch[field] !== undefined) {
      fields.push(field);
    }
  }
  if (patch.languages !== undefined) {
    fields.push('languages');
  }
  return fields;
}

async function appendProjectInformationEvents(input: {
  project: Project;
  changedFields: ProjectInformationRefreshField[];
  command: string;
  homeDir?: string;
}): Promise<void> {
  const coordination = createStudioCoordinationService({ homeDir: input.homeDir });
  const operationId = createStudioOperationId();
  const projectRef = await toProjectRef(input.project, input.homeDir);
  await coordination.appendStudioEvent({
    type: 'studio.projectRefreshRequested',
    projectRef,
    surface: 'projectInformation',
    changedFields: input.changedFields,
    source: { kind: 'cli', command: input.command },
    operationId,
  });
  await coordination.appendStudioEvent({
    type: 'studio.focusRequested',
    projectRef,
    focus: {
      screen: 'movieStudio',
      selection: { type: 'projectInformation' },
    },
    refresh: { project: true },
    source: { kind: 'cli', command: input.command },
    operationId,
  });
}

async function toProjectRef(
  project: Project,
  homeDir?: string
): Promise<StudioProjectRef> {
  return {
    name: project.projectName,
    id: project.id,
    storageRoot: await resolveRenkuStorageRoot({ homeDir }),
  };
}

function toProjectInformationOutput(shell: ProjectShell) {
  const project = shell.project;
  return {
    projectName: project.projectName,
    id: project.id,
    title: project.title,
    aspectRatio: project.aspectRatio,
    logline: project.logline,
    synopsis: project.synopsis,
    premise: project.premise,
    intendedAudience: project.intendedAudience,
    format: project.format,
    targetRuntimeMinutes: project.targetRuntimeMinutes,
    primaryGenre: project.primaryGenre,
    secondaryGenres: project.secondaryGenres,
    tones: project.tones,
    contentRatingIntent: project.contentRatingIntent,
    creativeBoundaries: project.creativeBoundaries,
    centralConflict: project.centralConflict,
    dramaticQuestion: project.dramaticQuestion,
    themes: project.themes,
    historicalBasis: project.historicalBasis,
    dramatizedElements: project.dramatizedElements,
    screenplayDraftStatus: project.screenplayDraftStatus,
    researchSources: project.researchSources,
    assumptions: project.assumptions,
    openQuestions: project.openQuestions,
    nextSteps: project.nextSteps,
    languages: shell.languages,
  };
}

const PROJECT_INFORMATION_OPTIONAL_FIELDS = [
  'premise', 'intendedAudience', 'format', 'targetRuntimeMinutes',
  'primaryGenre', 'secondaryGenres', 'tones', 'contentRatingIntent',
  'creativeBoundaries', 'centralConflict', 'dramaticQuestion', 'themes',
  'historicalBasis', 'dramatizedElements', 'screenplayDraftStatus',
  'researchSources', 'assumptions', 'openQuestions', 'nextSteps',
] as const;

function assignSetProjectInformationFields(
  patch: ProjectInformationPatch,
  flags: ProjectInformationFlags,
): void {
  const stringFields = [
    'premise', 'intendedAudience', 'format', 'primaryGenre',
    'contentRatingIntent', 'centralConflict', 'dramaticQuestion',
    'screenplayDraftStatus',
  ] as const;
  for (const field of stringFields) {
    if (flags[field] !== undefined) {
      patch[field] = String(flags[field]);
    }
  }
  if (flags.targetRuntimeMinutes !== undefined) {
    patch.targetRuntimeMinutes = Number(flags.targetRuntimeMinutes);
  }
  const arrayFields = [
    'secondaryGenres', 'tones', 'creativeBoundaries', 'themes',
    'historicalBasis', 'dramatizedElements', 'researchSources', 'assumptions',
    'openQuestions', 'nextSteps',
  ] as const;
  for (const field of arrayFields) {
    if (flags[field] !== undefined) {
      patch[field] = String(flags[field]).split(',').map((value) => value.trim());
    }
  }
}

function assignClearProjectInformationFields(
  patch: ProjectInformationPatch,
  flags: ProjectInformationFlags,
): void {
  for (const field of PROJECT_INFORMATION_OPTIONAL_FIELDS) {
    if (flags[field] !== undefined) {
      patch[field] = null;
    }
  }
}
