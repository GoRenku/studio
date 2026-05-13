import {
  buildDiagnosticResult,
  createDiagnosticError,
  createDiagnosticWarning,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
  type DiagnosticResult,
} from '@gorenku/studio-diagnostics';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ProjectDataError } from '../project-data-error.js';

export interface ProjectSetup {
  kind: 'renku.projectSetup';
  version: '0.1.0';
  project: ProjectSetupProject;
  languages?: ProjectSetupLanguage[];
  visualLanguageCategories?: ProjectSetupVisualLanguageCategory[];
  visualLanguage?: ProjectSetupVisualLanguage[];
  cast?: ProjectSetupCastMember[];
  continuityReferences?: ProjectSetupContinuityReference[];
  episodes?: ProjectSetupEpisode[];
  sequences?: ProjectSetupSequence[];
}

export interface ProjectSetupProject {
  name: string;
  title: string;
  type: 'standaloneMovie' | 'series';
  logline?: string;
  summary?: string;
  aspectRatio?: string;
}

export interface ProjectSetupLanguage {
  localeTag: string;
  displayName?: string;
  isBase?: boolean;
  supportsAudio?: boolean;
  supportsSubtitles?: boolean;
}

export interface ProjectSetupVisualLanguage {
  category: string;
  name: string;
  shortDescription?: string;
  priority: 'default' | 'situational' | 'rare';
  guidanceFile?: string;
  promptFile?: string;
  guidance?: string;
  prompt?: string;
}

export interface ProjectSetupVisualLanguageCategory {
  name: string;
  description?: string;
}

export interface ProjectSetupContinuityReference {
  kind: string;
  name: string;
  shortDescription?: string;
  descriptionFile?: string;
  description?: string;
}

export interface ProjectSetupCastMember {
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
  descriptionFile?: string;
  description?: string;
}

export interface ProjectSetupEpisode {
  title: string;
  shortTitle?: string;
  episodeNumber?: number;
  summary?: string;
  sequences?: ProjectSetupSequence[];
}

export interface ProjectSetupSequence {
  title: string;
  shortTitle?: string;
  summary?: string;
  scenes?: ProjectSetupScene[];
}

export interface ProjectSetupScene {
  title: string;
  summary?: string;
  clips?: ProjectSetupClip[];
}

export interface ProjectSetupClip {
  title: string;
  summary?: string;
  visualIntent?: string;
}

export interface ProjectSetupValidation {
  setup: ProjectSetup | null;
  result: DiagnosticResult;
}

export interface ProjectSetupReadResult {
  setup: ProjectSetup;
  result: DiagnosticResult;
  warnings: DiagnosticIssue[];
}

interface ValidationContext {
  filePath?: string;
  issues: DiagnosticIssue[];
}

export async function readProjectSetupOrThrow(
  setupPath: string
): Promise<ProjectSetupReadResult> {
  let parsed: unknown;
  try {
    parsed = parseYaml(await fs.readFile(setupPath, 'utf8'));
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to read project setup YAML: ${error.message}`
        : 'Failed to read project setup YAML.';
    throw new ProjectDataError('PROJECT_SETUP001', message, {
      issues: [
        createDiagnosticError(
          'PROJECT_SETUP001',
          message,
          {
            filePath: setupPath,
            path: [],
            context: 'project setup YAML',
          },
          'Check that the file exists and contains valid YAML.'
        ),
      ],
      suggestion: 'Check that the setup file exists and contains valid YAML.',
    });
  }

  const validation = validateProjectSetup(parsed, setupPath);
  throwIfDiagnosticResultInvalid(validation.result, {
    code: 'PROJECT_SETUP999',
    message: 'Project setup YAML failed validation.',
    suggestion: 'Fix the reported project setup errors and run the command again.',
  });

  if (!validation.setup) {
    throw new ProjectDataError(
      'PROJECT_SETUP999',
      'Project setup YAML failed validation.',
      {
        issues: validation.result.issues,
        suggestion: 'Fix the reported project setup errors and run the command again.',
      }
    );
  }

  const setup = await loadReferencedSetupMarkdown(
    validation.setup,
    setupPath,
    validation.result.issues
  );

  return {
    setup,
    result: validation.result,
    warnings: validation.result.warnings,
  };
}

export async function readProjectSetup(setupPath: string): Promise<ProjectSetup> {
  return (await readProjectSetupOrThrow(setupPath)).setup;
}

export function validateProjectSetup(
  input: unknown,
  filePath?: string
): ProjectSetupValidation {
  const context: ValidationContext = { filePath, issues: [] };
  const root = readRecord(context, input, [], 'project setup root');
  if (!root) {
    return buildValidation(null, context);
  }

  warnUnknownKeys(context, root, [], [
    'kind',
    'version',
    'project',
    'languages',
    'visualLanguageCategories',
    'visualLanguage',
    'cast',
    'continuityReferences',
    'episodes',
    'sequences',
  ]);

  const kind = readRequiredString(context, root, ['kind'], 'kind is required.');
  if (kind && kind !== 'renku.projectSetup') {
    addError(
      context,
      'PROJECT_SETUP005',
      'kind must be renku.projectSetup.',
      ['kind'],
      'Use kind: renku.projectSetup.'
    );
  }

  const version = readRequiredString(
    context,
    root,
    ['version'],
    'version is required.'
  );
  if (version && version !== '0.1.0') {
    addError(
      context,
      'PROJECT_SETUP005',
      'version must be 0.1.0.',
      ['version'],
      'Use version: 0.1.0.'
    );
  }

  const project = readProject(context, root.project, ['project']);
  const languages = readArrayItems(context, root.languages, ['languages'], readLanguage);
  const visualLanguageCategories = readArrayItems(
    context,
    root.visualLanguageCategories,
    ['visualLanguageCategories'],
    readVisualLanguageCategory
  );
  const visualLanguage = readArrayItems(
    context,
    root.visualLanguage,
    ['visualLanguage'],
    readVisualLanguage
  );
  const cast = readArrayItems(context, root.cast, ['cast'], readCast);
  const continuityReferences = readArrayItems(
    context,
    root.continuityReferences,
    ['continuityReferences'],
    readContinuityReference
  );
  const episodes = readArrayItems(context, root.episodes, ['episodes'], readEpisode);
  const sequences = readArrayItems(
    context,
    root.sequences,
    ['sequences'],
    readSequence
  );

  const result = buildDiagnosticResult(context.issues);
  if (!result.valid || !project || kind !== 'renku.projectSetup' || version !== '0.1.0') {
    return {
      setup: null,
      result,
    };
  }

  return {
    setup: {
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project,
      languages,
      visualLanguageCategories,
      visualLanguage,
      cast,
      continuityReferences,
      episodes,
      sequences,
    },
    result,
  };
}

function readProject(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupProject | null {
  const record = readRecord(context, input, path, 'project');
  if (!record) {
    return null;
  }

  warnUnknownKeys(context, record, path, [
    'name',
    'title',
    'type',
    'logline',
    'summary',
    'aspectRatio',
  ]);

  const name = readRequiredString(context, record, [...path, 'name'], 'project.name is required.');
  if (name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    addError(
      context,
      'PROJECT_SETUP005',
      'project.name must be kebab-case and contain only lowercase letters, numbers, and hyphens.',
      [...path, 'name'],
      'Use a folder-safe name such as constantinople.'
    );
  }

  const title = readRequiredString(
    context,
    record,
    [...path, 'title'],
    'project.title is required.'
  );
  const type = readRequiredString(
    context,
    record,
    [...path, 'type'],
    'project.type is required.'
  );
  if (type && type !== 'standaloneMovie' && type !== 'series') {
    addError(
      context,
      'PROJECT_SETUP005',
      'project.type must be standaloneMovie or series.',
      [...path, 'type'],
      'Use type: standaloneMovie or type: series.'
    );
  }

  if (
    !name ||
    !title ||
    (type !== 'standaloneMovie' && type !== 'series') ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
  ) {
    return null;
  }

  return {
    name,
    title,
    type,
    logline: readOptionalString(context, record, [...path, 'logline']),
    summary: readOptionalString(context, record, [...path, 'summary']),
    aspectRatio: readOptionalString(context, record, [...path, 'aspectRatio']),
  };
}

function readLanguage(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupLanguage | null {
  const record = readRecord(context, input, path, 'language');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, [
    'localeTag',
    'displayName',
    'isBase',
    'supportsAudio',
    'supportsSubtitles',
  ]);
  const localeTag = readRequiredString(
    context,
    record,
    [...path, 'localeTag'],
    `${formatPath([...path, 'localeTag'])} is required.`
  );
  if (!localeTag) {
    return null;
  }
  return {
    localeTag,
    displayName: readOptionalString(context, record, [...path, 'displayName']),
    isBase: readOptionalBoolean(context, record, [...path, 'isBase']),
    supportsAudio: readOptionalBoolean(context, record, [...path, 'supportsAudio']),
    supportsSubtitles: readOptionalBoolean(context, record, [
      ...path,
      'supportsSubtitles',
    ]),
  };
}

function readVisualLanguage(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupVisualLanguage | null {
  const record = readRecord(context, input, path, 'visualLanguage');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, [
    'category',
    'name',
    'shortDescription',
    'priority',
    'guidanceFile',
    'promptFile',
  ]);
  const category = readRequiredString(
    context,
    record,
    [...path, 'category'],
    `${formatPath([...path, 'category'])} is required.`
  );
  const name = readRequiredString(
    context,
    record,
    [...path, 'name'],
    `${formatPath([...path, 'name'])} is required.`
  );
  const priority =
    readOptionalString(context, record, [...path, 'priority']) ?? 'default';
  if (
    priority !== 'default' &&
    priority !== 'situational' &&
    priority !== 'rare'
  ) {
    addError(
      context,
      'PROJECT_SETUP005',
      `${formatPath([...path, 'priority'])} must be default, situational, or rare.`,
      [...path, 'priority'],
      'Use priority: default, priority: situational, or priority: rare.'
    );
  }
  if (!category || !name || !isVisualLanguagePriority(priority)) {
    return null;
  }
  return {
    category,
    name,
    shortDescription: readOptionalString(context, record, [
      ...path,
      'shortDescription',
    ]),
    priority,
    guidanceFile: readOptionalString(context, record, [...path, 'guidanceFile']),
    promptFile: readOptionalString(context, record, [...path, 'promptFile']),
  };
}

function readVisualLanguageCategory(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupVisualLanguageCategory | null {
  const record = readRecord(context, input, path, 'visualLanguageCategory');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, ['name', 'description']);
  const name = readRequiredString(
    context,
    record,
    [...path, 'name'],
    `${formatPath([...path, 'name'])} is required.`
  );
  if (!name) {
    return null;
  }
  return {
    name,
    description: readOptionalString(context, record, [...path, 'description']),
  };
}

function readContinuityReference(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupContinuityReference | null {
  const record = readRecord(context, input, path, 'continuityReference');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, [
    'kind',
    'name',
    'shortDescription',
    'descriptionFile',
  ]);
  const kind = readRequiredString(
    context,
    record,
    [...path, 'kind'],
    `${formatPath([...path, 'kind'])} is required.`
  );
  const name = readRequiredString(
    context,
    record,
    [...path, 'name'],
    `${formatPath([...path, 'name'])} is required.`
  );
  if (!kind || !name) {
    return null;
  }
  return {
    kind,
    name,
    shortDescription: readOptionalString(context, record, [
      ...path,
      'shortDescription',
    ]),
    descriptionFile: readOptionalString(context, record, [
      ...path,
      'descriptionFile',
    ]),
  };
}

function readCast(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupCastMember | null {
  const record = readRecord(context, input, path, 'cast');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, [
    'name',
    'kind',
    'role',
    'shortDescription',
    'descriptionFile',
  ]);
  const name = readRequiredString(
    context,
    record,
    [...path, 'name'],
    `${formatPath([...path, 'name'])} is required.`
  );
  if (!name) {
    return null;
  }
  return {
    name,
    kind: readOptionalString(context, record, [...path, 'kind']),
    role: readOptionalString(context, record, [...path, 'role']),
    shortDescription: readOptionalString(context, record, [
      ...path,
      'shortDescription',
    ]),
    descriptionFile: readOptionalString(context, record, [
      ...path,
      'descriptionFile',
    ]),
  };
}

function readEpisode(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupEpisode | null {
  const record = readRecord(context, input, path, 'episode');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, [
    'title',
    'shortTitle',
    'episodeNumber',
    'summary',
    'sequences',
  ]);
  const title = readRequiredString(
    context,
    record,
    [...path, 'title'],
    `${formatPath([...path, 'title'])} is required.`
  );
  if (!title) {
    return null;
  }
  return {
    title,
    shortTitle: readOptionalString(context, record, [...path, 'shortTitle']),
    episodeNumber: readOptionalNumber(context, record, [
      ...path,
      'episodeNumber',
    ]),
    summary: readOptionalString(context, record, [...path, 'summary']),
    sequences: readArrayItems(context, record.sequences, [...path, 'sequences'], readSequence),
  };
}

function readSequence(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupSequence | null {
  const record = readRecord(context, input, path, 'sequence');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, ['title', 'shortTitle', 'summary', 'scenes']);
  const title = readRequiredString(
    context,
    record,
    [...path, 'title'],
    `${formatPath([...path, 'title'])} is required.`
  );
  if (!title) {
    return null;
  }
  return {
    title,
    shortTitle: readOptionalString(context, record, [...path, 'shortTitle']),
    summary: readOptionalString(context, record, [...path, 'summary']),
    scenes: readArrayItems(context, record.scenes, [...path, 'scenes'], readScene),
  };
}

function readScene(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupScene | null {
  const record = readRecord(context, input, path, 'scene');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, ['title', 'summary', 'clips']);
  const title = readRequiredString(
    context,
    record,
    [...path, 'title'],
    `${formatPath([...path, 'title'])} is required.`
  );
  if (!title) {
    return null;
  }
  return {
    title,
    summary: readOptionalString(context, record, [...path, 'summary']),
    clips: readArrayItems(context, record.clips, [...path, 'clips'], readClip),
  };
}

function readClip(
  context: ValidationContext,
  input: unknown,
  path: string[]
): ProjectSetupClip | null {
  const record = readRecord(context, input, path, 'clip');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, path, ['title', 'summary', 'visualIntent']);
  const title = readRequiredString(
    context,
    record,
    [...path, 'title'],
    `${formatPath([...path, 'title'])} is required.`
  );
  if (!title) {
    return null;
  }
  return {
    title,
    summary: readOptionalString(context, record, [...path, 'summary']),
    visualIntent: readOptionalString(context, record, [...path, 'visualIntent']),
  };
}

function readArrayItems<T>(
  context: ValidationContext,
  input: unknown,
  path: string[],
  reader: (
    context: ValidationContext,
    input: unknown,
    path: string[]
  ) => T | null
): T[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    addError(
      context,
      'PROJECT_SETUP004',
      `${formatPath(path)} must be an array.`,
      path
    );
    return undefined;
  }
  return input
    .map((item, index) => reader(context, item, [...path, String(index)]))
    .filter((item): item is T => item !== null);
}

function readRecord(
  context: ValidationContext,
  input: unknown,
  path: string[],
  label: string
): Record<string, unknown> | null {
  if (!isRecord(input)) {
    addError(
      context,
      'PROJECT_SETUP004',
      `${label} must be an object.`,
      path
    );
    return null;
  }
  return input;
}

function readRequiredString(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string[],
  message: string
): string | null {
  const value = record[path[path.length - 1]];
  if (value === undefined) {
    addError(context, 'PROJECT_SETUP003', message, path);
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    addError(
      context,
      'PROJECT_SETUP004',
      `${formatPath(path)} must be a non-empty string.`,
      path
    );
    return null;
  }
  return value;
}

function readOptionalString(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string[]
): string | undefined {
  const value = record[path[path.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    addError(
      context,
      'PROJECT_SETUP004',
      `${formatPath(path)} must be a string.`,
      path
    );
    return undefined;
  }
  return value;
}

function readOptionalBoolean(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string[]
): boolean | undefined {
  const value = record[path[path.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    addError(
      context,
      'PROJECT_SETUP004',
      `${formatPath(path)} must be a boolean.`,
      path
    );
    return undefined;
  }
  return value;
}

function readOptionalNumber(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string[]
): number | undefined {
  const value = record[path[path.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addError(
      context,
      'PROJECT_SETUP004',
      `${formatPath(path)} must be a number.`,
      path
    );
    return undefined;
  }
  return value;
}

function isVisualLanguagePriority(
  value: string
): value is ProjectSetupVisualLanguage['priority'] {
  return value === 'default' || value === 'situational' || value === 'rare';
}

async function loadReferencedSetupMarkdown(
  setup: ProjectSetup,
  setupPath: string,
  existingIssues: DiagnosticIssue[]
): Promise<ProjectSetup> {
  const context: ValidationContext = {
    filePath: setupPath,
    issues: [...existingIssues],
  };
  const setupDir = path.dirname(setupPath);

  const visualLanguage = await Promise.all(
    (setup.visualLanguage ?? []).map(async (entry, index) => ({
      ...entry,
      guidance: await readReferencedMarkdownFile(context, {
        setupDir,
        filePath: entry.guidanceFile,
        yamlPath: ['visualLanguage', String(index), 'guidanceFile'],
        label: `${entry.name} guidance`,
      }),
      prompt: await readReferencedMarkdownFile(context, {
        setupDir,
        filePath: entry.promptFile,
        yamlPath: ['visualLanguage', String(index), 'promptFile'],
        label: `${entry.name} prompt`,
      }),
    }))
  );

  const cast = await Promise.all(
    (setup.cast ?? []).map(async (entry, index) => ({
      ...entry,
      description: await readReferencedMarkdownFile(context, {
        setupDir,
        filePath: entry.descriptionFile,
        yamlPath: ['cast', String(index), 'descriptionFile'],
        label: `${entry.name} description`,
      }),
    }))
  );

  const continuityReferences = await Promise.all(
    (setup.continuityReferences ?? []).map(async (entry, index) => ({
      ...entry,
      description: await readReferencedMarkdownFile(context, {
        setupDir,
        filePath: entry.descriptionFile,
        yamlPath: ['continuityReferences', String(index), 'descriptionFile'],
        label: `${entry.name} description`,
      }),
    }))
  );

  const result = buildDiagnosticResult(context.issues);
  throwIfDiagnosticResultInvalid(result, {
    code: 'PROJECT_SETUP999',
    message: 'Project setup YAML failed validation.',
    suggestion: 'Fix the reported project setup errors and run the command again.',
  });

  return {
    ...setup,
    cast,
    visualLanguage,
    continuityReferences,
  };
}

async function readReferencedMarkdownFile(
  context: ValidationContext,
  input: {
    setupDir: string;
    filePath?: string;
    yamlPath: string[];
    label: string;
  }
): Promise<string | undefined> {
  if (!input.filePath?.trim()) {
    return undefined;
  }
  if (path.isAbsolute(input.filePath)) {
    addError(
      context,
      'PROJECT_SETUP006',
      `${formatPath(input.yamlPath)} must be relative to the setup file.`,
      input.yamlPath,
      'Use a setup-relative Markdown path such as sample-project/visual-language/camera/example/prompt.md.'
    );
    return undefined;
  }

  const resolvedPath = path.resolve(input.setupDir, input.filePath);
  const relativePath = path.relative(input.setupDir, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    addError(
      context,
      'PROJECT_SETUP006',
      `${formatPath(input.yamlPath)} must stay inside the setup directory.`,
      input.yamlPath,
      'Move the Markdown file under the setup directory and reference it with a relative path.'
    );
    return undefined;
  }

  try {
    return await fs.readFile(resolvedPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      addError(
        context,
        'PROJECT_SETUP007',
        `Referenced Markdown file for ${input.label} does not exist: ${input.filePath}.`,
        input.yamlPath,
        'Create the referenced Markdown file or update the setup path.'
      );
      return undefined;
    }
    throw error;
  }
}

function warnUnknownKeys(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string[],
  allowedKeys: string[]
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (allowed.has(key)) {
      continue;
    }
    const issuePath = [...path, key];
    context.issues.push(
      createDiagnosticWarning(
        'PROJECT_SETUP100',
        `Unknown field ${formatPath(issuePath)} will be ignored.`,
        {
          filePath: context.filePath,
          path: issuePath,
          context: 'project setup YAML',
        },
        'Remove the field or rename it to a supported camelCase setup field.'
      )
    );
  }
}

function addError(
  context: ValidationContext,
  code: string,
  message: string,
  path: string[],
  suggestion?: string
): void {
  context.issues.push(
    createDiagnosticError(
      code,
      message,
      {
        filePath: context.filePath,
        path,
        context: 'project setup YAML',
      },
      suggestion
    )
  );
}

function buildValidation(
  setup: ProjectSetup | null,
  context: ValidationContext
): ProjectSetupValidation {
  return {
    setup,
    result: buildDiagnosticResult(context.issues),
  };
}

function formatPath(path: string[]): string {
  if (path.length === 0) {
    return '<root>';
  }
  return path.reduce((label, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${label}[${segment}]`;
    }
    return label ? `${label}.${segment}` : segment;
  }, '');
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isNodeError(error: unknown): error is Error & { code?: unknown } {
  return error instanceof Error && 'code' in error;
}
