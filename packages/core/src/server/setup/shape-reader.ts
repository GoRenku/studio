import type {
  ProjectSetup,
  ProjectSetupCastMember,
  ProjectSetupClip,
  ProjectSetupContinuityReference,
  ProjectSetupEpisode,
  ProjectSetupLanguage,
  ProjectSetupProject,
  ProjectSetupScene,
  ProjectSetupSequence,
  ProjectSetupVisualLanguage,
  ProjectSetupVisualLanguageCategory,
} from './contracts.js';
import {
  addProjectSetupError,
  formatProjectSetupPath,
  readArrayItems,
  readOptionalBoolean,
  readOptionalNumber,
  readOptionalString,
  readRecord,
  readRequiredString,
  validateProjectSetupTextOrFile,
  warnUnknownProjectSetupKeys,
  type ProjectSetupReaderContext,
} from './reader-fields.js';

export function readProjectSetupShape(input: {
  context: ProjectSetupReaderContext;
  root: Record<string, unknown>;
  kind: 'renku.projectSetup';
  version: '0.1.0';
}): ProjectSetup | null {
  const project = readProject(input.context, input.root.project, ['project']);
  const languages = readArrayItems(
    input.context,
    input.root.languages,
    ['languages'],
    readLanguage
  );
  const visualLanguageCategories = readArrayItems(
    input.context,
    input.root.visualLanguageCategories,
    ['visualLanguageCategories'],
    readVisualLanguageCategory
  );
  const visualLanguage = readArrayItems(
    input.context,
    input.root.visualLanguage,
    ['visualLanguage'],
    readVisualLanguage
  );
  const cast = readArrayItems(input.context, input.root.cast, ['cast'], readCast);
  const continuityReferences = readArrayItems(
    input.context,
    input.root.continuityReferences,
    ['continuityReferences'],
    readContinuityReference
  );
  const episodes = readArrayItems(
    input.context,
    input.root.episodes,
    ['episodes'],
    readEpisode
  );
  const sequences = readArrayItems(
    input.context,
    input.root.sequences,
    ['sequences'],
    readSequence
  );

  validateProjectScreenplayContainers(
    input.context,
    project,
    episodes,
    sequences
  );
  if (!project) {
    return null;
  }
  return {
    kind: input.kind,
    version: input.version,
    project,
    languages,
    visualLanguageCategories,
    visualLanguage,
    cast,
    continuityReferences,
    episodes,
    sequences,
  };
}

function readProject(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupProject | null {
  const record = readRecord(context, input, yamlPath, 'project');
  if (!record) {
    return null;
  }

  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'name',
    'title',
    'type',
    'coverFile',
    'logline',
    'summary',
    'summaryFile',
    'aspectRatio',
  ]);

  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    'project.name is required.'
  );
  if (name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP005',
      'project.name must be kebab-case and contain only lowercase letters, numbers, and hyphens.',
      [...yamlPath, 'name'],
      'Use a folder-safe name such as constantinople.'
    );
  }

  const title = readRequiredString(
    context,
    record,
    [...yamlPath, 'title'],
    'project.title is required.'
  );
  const type = readRequiredString(
    context,
    record,
    [...yamlPath, 'type'],
    'project.type is required.'
  );
  if (type && type !== 'standaloneMovie' && type !== 'series') {
    addProjectSetupError(
      context,
      'PROJECT_SETUP005',
      'project.type must be standaloneMovie or series.',
      [...yamlPath, 'type'],
      'Use type: standaloneMovie or type: series.'
    );
  }

  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'summary',
    summary,
    summaryFile
  );

  if (
    !name ||
    !title ||
    (type !== 'standaloneMovie' && type !== 'series') ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
    Boolean(summary && summaryFile)
  ) {
    return null;
  }

  return {
    name,
    title,
    type,
    coverFile: readOptionalString(context, record, [...yamlPath, 'coverFile']),
    logline: readOptionalString(context, record, [...yamlPath, 'logline']),
    summary,
    summaryFile,
    aspectRatio: readOptionalString(context, record, [...yamlPath, 'aspectRatio']),
  };
}

function readLanguage(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupLanguage | null {
  const record = readRecord(context, input, yamlPath, 'language');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'localeTag',
    'displayName',
    'isBase',
    'supportsAudio',
    'supportsSubtitles',
  ]);
  const localeTag = readRequiredString(
    context,
    record,
    [...yamlPath, 'localeTag'],
    `${formatProjectSetupPath([...yamlPath, 'localeTag'])} is required.`
  );
  if (!localeTag) {
    return null;
  }
  return {
    localeTag,
    displayName: readOptionalString(context, record, [...yamlPath, 'displayName']),
    isBase: readOptionalBoolean(context, record, [...yamlPath, 'isBase']),
    supportsAudio: readOptionalBoolean(context, record, [
      ...yamlPath,
      'supportsAudio',
    ]),
    supportsSubtitles: readOptionalBoolean(context, record, [
      ...yamlPath,
      'supportsSubtitles',
    ]),
  };
}

function readVisualLanguage(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupVisualLanguage | null {
  const record = readRecord(context, input, yamlPath, 'visualLanguage');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'category',
    'name',
    'shortDescription',
    'priority',
    'guidance',
    'guidanceFile',
    'prompt',
    'promptFile',
  ]);
  const category = readRequiredString(
    context,
    record,
    [...yamlPath, 'category'],
    `${formatProjectSetupPath([...yamlPath, 'category'])} is required.`
  );
  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    `${formatProjectSetupPath([...yamlPath, 'name'])} is required.`
  );
  const priority =
    readOptionalString(context, record, [...yamlPath, 'priority']) ?? 'default';
  if (!isVisualLanguagePriority(priority)) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP005',
      `${formatProjectSetupPath([...yamlPath, 'priority'])} must be default, situational, or rare.`,
      [...yamlPath, 'priority'],
      'Use priority: default, priority: situational, or priority: rare.'
    );
  }
  const guidance = readOptionalString(context, record, [...yamlPath, 'guidance']);
  const guidanceFile = readOptionalString(context, record, [
    ...yamlPath,
    'guidanceFile',
  ]);
  const prompt = readOptionalString(context, record, [...yamlPath, 'prompt']);
  const promptFile = readOptionalString(context, record, [
    ...yamlPath,
    'promptFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'guidance',
    guidance,
    guidanceFile
  );
  validateProjectSetupTextOrFile(context, yamlPath, 'prompt', prompt, promptFile);
  if (
    !category ||
    !name ||
    !isVisualLanguagePriority(priority) ||
    Boolean(guidance && guidanceFile) ||
    Boolean(prompt && promptFile)
  ) {
    return null;
  }
  return {
    category,
    name,
    shortDescription: readOptionalString(context, record, [
      ...yamlPath,
      'shortDescription',
    ]),
    priority,
    guidance,
    guidanceFile,
    prompt,
    promptFile,
  };
}

function readVisualLanguageCategory(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupVisualLanguageCategory | null {
  const record = readRecord(context, input, yamlPath, 'visualLanguageCategory');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, ['name', 'description']);
  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    `${formatProjectSetupPath([...yamlPath, 'name'])} is required.`
  );
  if (!name) {
    return null;
  }
  return {
    name,
    description: readOptionalString(context, record, [...yamlPath, 'description']),
  };
}

function readContinuityReference(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupContinuityReference | null {
  const record = readRecord(context, input, yamlPath, 'continuityReference');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'kind',
    'name',
    'shortDescription',
    'description',
    'descriptionFile',
  ]);
  const kind = readRequiredString(
    context,
    record,
    [...yamlPath, 'kind'],
    `${formatProjectSetupPath([...yamlPath, 'kind'])} is required.`
  );
  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    `${formatProjectSetupPath([...yamlPath, 'name'])} is required.`
  );
  const description = readOptionalString(context, record, [
    ...yamlPath,
    'description',
  ]);
  const descriptionFile = readOptionalString(context, record, [
    ...yamlPath,
    'descriptionFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'description',
    description,
    descriptionFile
  );
  if (!kind || !name || Boolean(description && descriptionFile)) {
    return null;
  }
  return {
    kind,
    name,
    shortDescription: readOptionalString(context, record, [
      ...yamlPath,
      'shortDescription',
    ]),
    description,
    descriptionFile,
  };
}

function readCast(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupCastMember | null {
  const record = readRecord(context, input, yamlPath, 'cast');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'name',
    'kind',
    'role',
    'shortDescription',
    'description',
    'descriptionFile',
  ]);
  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    `${formatProjectSetupPath([...yamlPath, 'name'])} is required.`
  );
  const description = readOptionalString(context, record, [
    ...yamlPath,
    'description',
  ]);
  const descriptionFile = readOptionalString(context, record, [
    ...yamlPath,
    'descriptionFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'description',
    description,
    descriptionFile
  );
  if (!name || Boolean(description && descriptionFile)) {
    return null;
  }
  return {
    name,
    kind: readOptionalString(context, record, [...yamlPath, 'kind']),
    role: readOptionalString(context, record, [...yamlPath, 'role']),
    shortDescription: readOptionalString(context, record, [
      ...yamlPath,
      'shortDescription',
    ]),
    description,
    descriptionFile,
  };
}

function readEpisode(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupEpisode | null {
  const record = readRecord(context, input, yamlPath, 'episode');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'title',
    'shortTitle',
    'episodeNumber',
    'summary',
    'summaryFile',
    'sequences',
  ]);
  const title = readRequiredString(
    context,
    record,
    [...yamlPath, 'title'],
    `${formatProjectSetupPath([...yamlPath, 'title'])} is required.`
  );
  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'summary',
    summary,
    summaryFile
  );
  if (!title || Boolean(summary && summaryFile)) {
    return null;
  }
  return {
    title,
    shortTitle: readOptionalString(context, record, [...yamlPath, 'shortTitle']),
    episodeNumber: readOptionalNumber(context, record, [
      ...yamlPath,
      'episodeNumber',
    ]),
    summary,
    summaryFile,
    sequences: readArrayItems(
      context,
      record.sequences,
      [...yamlPath, 'sequences'],
      readSequence
    ),
  };
}

function readSequence(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupSequence | null {
  const record = readRecord(context, input, yamlPath, 'sequence');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'title',
    'shortTitle',
    'summary',
    'summaryFile',
    'scenes',
  ]);
  const title = readRequiredString(
    context,
    record,
    [...yamlPath, 'title'],
    `${formatProjectSetupPath([...yamlPath, 'title'])} is required.`
  );
  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'summary',
    summary,
    summaryFile
  );
  if (!title || Boolean(summary && summaryFile)) {
    return null;
  }
  return {
    title,
    shortTitle: readOptionalString(context, record, [...yamlPath, 'shortTitle']),
    summary,
    summaryFile,
    scenes: readArrayItems(context, record.scenes, [...yamlPath, 'scenes'], readScene),
  };
}

function readScene(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupScene | null {
  const record = readRecord(context, input, yamlPath, 'scene');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'title',
    'summary',
    'summaryFile',
    'clips',
  ]);
  const title = readRequiredString(
    context,
    record,
    [...yamlPath, 'title'],
    `${formatProjectSetupPath([...yamlPath, 'title'])} is required.`
  );
  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'summary',
    summary,
    summaryFile
  );
  if (!title || Boolean(summary && summaryFile)) {
    return null;
  }
  return {
    title,
    summary,
    summaryFile,
    clips: readArrayItems(context, record.clips, [...yamlPath, 'clips'], readClip),
  };
}

function readClip(
  context: ProjectSetupReaderContext,
  input: unknown,
  yamlPath: string[]
): ProjectSetupClip | null {
  const record = readRecord(context, input, yamlPath, 'clip');
  if (!record) {
    return null;
  }
  warnUnknownProjectSetupKeys(context, record, yamlPath, [
    'title',
    'summary',
    'summaryFile',
    'visualIntent',
    'visualIntentFile',
  ]);
  const title = readRequiredString(
    context,
    record,
    [...yamlPath, 'title'],
    `${formatProjectSetupPath([...yamlPath, 'title'])} is required.`
  );
  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  const visualIntent = readOptionalString(context, record, [
    ...yamlPath,
    'visualIntent',
  ]);
  const visualIntentFile = readOptionalString(context, record, [
    ...yamlPath,
    'visualIntentFile',
  ]);
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'summary',
    summary,
    summaryFile
  );
  validateProjectSetupTextOrFile(
    context,
    yamlPath,
    'visualIntent',
    visualIntent,
    visualIntentFile
  );
  if (
    !title ||
    Boolean(summary && summaryFile) ||
    Boolean(visualIntent && visualIntentFile)
  ) {
    return null;
  }
  return {
    title,
    summary,
    summaryFile,
    visualIntent,
    visualIntentFile,
  };
}

function validateProjectScreenplayContainers(
  context: ProjectSetupReaderContext,
  project: ProjectSetupProject | null,
  episodes: ProjectSetupEpisode[] | undefined,
  sequences: ProjectSetupSequence[] | undefined
): void {
  if (!project) {
    return;
  }
  if (project.type === 'series' && (sequences?.length ?? 0) > 0) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP011',
      'Series projects must put sequences inside episodes.',
      ['sequences'],
      'Move top-level sequences under episodes[].sequences.'
    );
  }
  if (project.type === 'standaloneMovie' && (episodes?.length ?? 0) > 0) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP012',
      'Standalone movie projects must not define episodes.',
      ['episodes'],
      'Use top-level sequences for standalone movies, or set project.type: series.'
    );
  }
}

function isVisualLanguagePriority(
  value: string
): value is ProjectSetupVisualLanguage['priority'] {
  return value === 'default' || value === 'situational' || value === 'rare';
}
