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

export interface NarrativeStarter {
  kind: 'renku.narrativeStarter';
  version: '0.1.0';
  project: NarrativeStarterProject;
  languages: NarrativeStarterLanguage[];
  visualLanguageCategories?: NarrativeStarterVisualLanguageCategory[];
  visualLanguage?: NarrativeStarterVisualLanguage[];
  cast?: NarrativeStarterCastMember[];
  continuityReferences?: NarrativeStarterContinuityReference[];
  sequences: NarrativeStarterSequence[];
}

export interface NarrativeStarterProject {
  name: string;
  title: string;
  type: 'standaloneMovie' | 'series';
  aspectRatio: string;
  coverFile?: string;
  logline: string;
  summary?: string;
  summaryFile?: string;
}

export interface NarrativeStarterLanguage {
  localeTag: string;
  displayName?: string;
  isBase?: boolean;
  supportsAudio?: boolean;
  supportsSubtitles?: boolean;
}

export interface NarrativeStarterCastMember {
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
  description?: string;
  descriptionFile?: string;
}

export interface NarrativeStarterVisualLanguageCategory {
  name: string;
  description?: string;
}

export interface NarrativeStarterVisualLanguage {
  category: string;
  name: string;
  shortDescription?: string;
  priority: 'default' | 'situational' | 'rare';
  guidance?: string;
  guidanceFile?: string;
  prompt?: string;
  promptFile?: string;
}

export interface NarrativeStarterContinuityReference {
  kind: string;
  name: string;
  shortDescription?: string;
  description?: string;
  descriptionFile?: string;
}

export interface NarrativeStarterSequence {
  title: string;
  shortTitle?: string;
  summary?: string;
  summaryFile?: string;
  scenes?: NarrativeStarterScene[];
}

export interface NarrativeStarterScene {
  title: string;
  summary?: string;
  summaryFile?: string;
  clips?: NarrativeStarterClip[];
}

export interface NarrativeStarterClip {
  title: string;
  summary?: string;
  summaryFile?: string;
  visualIntent?: string;
  visualIntentFile?: string;
}

export interface NarrativeStarterValidation {
  starter: NarrativeStarter | null;
  result: DiagnosticResult;
}

export interface NarrativeStarterReadResult {
  starter: NarrativeStarter;
  result: DiagnosticResult;
  warnings: DiagnosticIssue[];
}

interface ValidationContext {
  filePath?: string;
  issues: DiagnosticIssue[];
}

export async function readNarrativeStarterOrThrow(
  starterPath: string
): Promise<NarrativeStarterReadResult> {
  let parsed: unknown;
  try {
    parsed = parseYaml(await fs.readFile(starterPath, 'utf8'));
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to read narrative starter YAML: ${error.message}`
        : 'Failed to read narrative starter YAML.';
    throw new ProjectDataError('NARRATIVE_STARTER001', message, {
      issues: [
        createDiagnosticError(
          'NARRATIVE_STARTER001',
          message,
          {
            filePath: starterPath,
            path: [],
            context: 'narrative starter YAML',
          },
          'Check that the file exists and contains valid YAML.'
        ),
      ],
      suggestion: 'Check that the narrative starter exists and contains valid YAML.',
    });
  }

  const validation = validateNarrativeStarter(parsed, starterPath);
  throwIfDiagnosticResultInvalid(validation.result, {
    code: 'NARRATIVE_STARTER999',
    message: 'Narrative starter YAML failed validation.',
    suggestion: 'Fix the reported narrative starter errors and run the command again.',
  });

  if (!validation.starter) {
    throw new ProjectDataError(
      'NARRATIVE_STARTER999',
      'Narrative starter YAML failed validation.',
      {
        issues: validation.result.issues,
        suggestion: 'Fix the reported narrative starter errors and run the command again.',
      }
    );
  }

  const starter = await loadReferencedNarrativeMarkdown(
    validation.starter,
    starterPath,
    validation.result.issues
  );

  return {
    starter,
    result: buildDiagnosticResult(validation.result.issues),
    warnings: validation.result.warnings,
  };
}

export function validateNarrativeStarter(
  input: unknown,
  filePath?: string
): NarrativeStarterValidation {
  const context: ValidationContext = {
    filePath,
    issues: [],
  };
  const root = readRecord(context, input, [], 'narrative starter root');
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
    'sequences',
  ]);

  const kind = readRequiredString(context, root, ['kind'], 'kind is required.');
  if (kind && kind !== 'renku.narrativeStarter') {
    addError(
      context,
      'NARRATIVE_STARTER002',
      'kind must be renku.narrativeStarter.',
      ['kind'],
      'Use kind: renku.narrativeStarter.'
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
      'NARRATIVE_STARTER003',
      'version must be 0.1.0.',
      ['version'],
      'Use version: 0.1.0.'
    );
  }

  const project = readProject(context, root.project, ['project']);
  const languages = readArrayItems(
    context,
    root.languages,
    ['languages'],
    readLanguage
  );
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
  const sequences = readArrayItems(
    context,
    root.sequences,
    ['sequences'],
    readSequence
  );

  validateLanguages(context, languages);
  if (!sequences || sequences.length === 0) {
    addError(
      context,
      'NARRATIVE_STARTER040',
      'At least one sequence is required.',
      ['sequences'],
      'Add at least one sequence with a title.'
    );
  }

  const result = buildDiagnosticResult(context.issues);
  if (
    !result.valid ||
    !project ||
    !languages ||
    languages.length === 0 ||
    !sequences ||
    sequences.length === 0 ||
    kind !== 'renku.narrativeStarter' ||
    version !== '0.1.0'
  ) {
    return { starter: null, result };
  }

  return {
    starter: {
      kind: 'renku.narrativeStarter',
      version: '0.1.0',
      project,
      languages,
      visualLanguageCategories,
      visualLanguage,
      cast,
      continuityReferences,
      sequences,
    },
    result,
  };
}

function readProject(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterProject | null {
  const record = readRecord(context, input, yamlPath, 'project');
  if (!record) {
    return null;
  }

  warnUnknownKeys(context, record, yamlPath, [
    'name',
    'title',
    'type',
    'aspectRatio',
    'coverFile',
    'logline',
    'summary',
    'summaryFile',
  ]);

  const name = readOptionalString(context, record, [...yamlPath, 'name']);
  if (!name) {
    addError(
      context,
      'NARRATIVE_STARTER010',
      'project.name is required.',
      [...yamlPath, 'name'],
      'Set project.name.'
    );
  }
  if (name && !isValidProjectName(name)) {
    addError(
      context,
      'NARRATIVE_STARTER011',
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
    addError(
      context,
      'NARRATIVE_STARTER011',
      'project.type must be standaloneMovie or series.',
      [...yamlPath, 'type'],
      'Use type: standaloneMovie or type: series.'
    );
  }

  const aspectRatio = readRequiredString(
    context,
    record,
    [...yamlPath, 'aspectRatio'],
    'project.aspectRatio is required.'
  );
  if (aspectRatio && !isSupportedAspectRatio(aspectRatio)) {
    addError(
      context,
      'NARRATIVE_STARTER011',
      'project.aspectRatio is not supported.',
      [...yamlPath, 'aspectRatio'],
      'Use one of 1:1, 3:4, 4:3, 16:9, 9:16, or 21:9.'
    );
  }

  const logline = readRequiredString(
    context,
    record,
    [...yamlPath, 'logline'],
    'project.logline is required.'
  );
  const coverFile = readOptionalString(context, record, [
    ...yamlPath,
    'coverFile',
  ]);
  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  validateTextOrFile(context, [...yamlPath], 'summary', summary, summaryFile);

  if (
    !name ||
    !isValidProjectName(name) ||
    !title ||
    (type !== 'standaloneMovie' && type !== 'series') ||
    !aspectRatio ||
    !isSupportedAspectRatio(aspectRatio) ||
    !logline ||
    Boolean(summary && summaryFile)
  ) {
    return null;
  }

  return {
    name,
    title,
    type,
    aspectRatio,
    coverFile,
    logline,
    summary,
    summaryFile,
  };
}

function readLanguage(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterLanguage | null {
  const record = readRecord(context, input, yamlPath, 'language');
  if (!record) {
    return null;
  }

  warnUnknownKeys(context, record, yamlPath, [
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
    `${formatPath([...yamlPath, 'localeTag'])} is required.`
  );
  if (localeTag && !isLikelyLocaleTag(localeTag)) {
    addError(
      context,
      'NARRATIVE_STARTER011',
      `${formatPath([...yamlPath, 'localeTag'])} must be a valid locale tag.`,
      [...yamlPath, 'localeTag'],
      'Use a BCP 47 style locale tag such as en-US or tr-TR.'
    );
  }
  if (!localeTag || !isLikelyLocaleTag(localeTag)) {
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

function readCast(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterCastMember | null {
  const record = readRecord(context, input, yamlPath, 'cast member');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, yamlPath, [
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
    `${formatPath([...yamlPath, 'name'])} is required.`
  );
  const description = readOptionalString(context, record, [
    ...yamlPath,
    'description',
  ]);
  const descriptionFile = readOptionalString(context, record, [
    ...yamlPath,
    'descriptionFile',
  ]);
  validateTextOrFile(
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

function readVisualLanguageCategory(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterVisualLanguageCategory | null {
  const record = readRecord(context, input, yamlPath, 'visual language category');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, yamlPath, ['name', 'description']);
  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    `${formatPath([...yamlPath, 'name'])} is required.`
  );
  if (!name) {
    return null;
  }
  return {
    name,
    description: readOptionalString(context, record, [
      ...yamlPath,
      'description',
    ]),
  };
}

function readVisualLanguage(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterVisualLanguage | null {
  const record = readRecord(context, input, yamlPath, 'visual language');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, yamlPath, [
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
    `${formatPath([...yamlPath, 'category'])} is required.`
  );
  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    `${formatPath([...yamlPath, 'name'])} is required.`
  );
  const priority =
    readOptionalString(context, record, [...yamlPath, 'priority']) ?? 'default';
  if (!isVisualLanguagePriority(priority)) {
    addError(
      context,
      'NARRATIVE_STARTER011',
      `${formatPath([...yamlPath, 'priority'])} must be default, situational, or rare.`,
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
  validateTextOrFile(context, yamlPath, 'guidance', guidance, guidanceFile);
  validateTextOrFile(context, yamlPath, 'prompt', prompt, promptFile);
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

function readContinuityReference(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterContinuityReference | null {
  const record = readRecord(context, input, yamlPath, 'continuity reference');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, yamlPath, [
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
    `${formatPath([...yamlPath, 'kind'])} is required.`
  );
  const name = readRequiredString(
    context,
    record,
    [...yamlPath, 'name'],
    `${formatPath([...yamlPath, 'name'])} is required.`
  );
  const description = readOptionalString(context, record, [
    ...yamlPath,
    'description',
  ]);
  const descriptionFile = readOptionalString(context, record, [
    ...yamlPath,
    'descriptionFile',
  ]);
  validateTextOrFile(
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

function readSequence(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterSequence | null {
  const record = readRecord(context, input, yamlPath, 'sequence');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, yamlPath, [
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
    `${formatPath([...yamlPath, 'title'])} is required.`
  );
  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  validateTextOrFile(context, yamlPath, 'summary', summary, summaryFile);
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
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterScene | null {
  const record = readRecord(context, input, yamlPath, 'scene');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, yamlPath, [
    'title',
    'summary',
    'summaryFile',
    'clips',
  ]);
  const title = readRequiredString(
    context,
    record,
    [...yamlPath, 'title'],
    `${formatPath([...yamlPath, 'title'])} is required.`
  );
  const summary = readOptionalString(context, record, [...yamlPath, 'summary']);
  const summaryFile = readOptionalString(context, record, [
    ...yamlPath,
    'summaryFile',
  ]);
  validateTextOrFile(context, yamlPath, 'summary', summary, summaryFile);
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
  context: ValidationContext,
  input: unknown,
  yamlPath: string[]
): NarrativeStarterClip | null {
  const record = readRecord(context, input, yamlPath, 'clip');
  if (!record) {
    return null;
  }
  warnUnknownKeys(context, record, yamlPath, [
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
    `${formatPath([...yamlPath, 'title'])} is required.`
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
  validateTextOrFile(context, yamlPath, 'summary', summary, summaryFile);
  validateTextOrFile(
    context,
    yamlPath,
    'visualIntent',
    visualIntent,
    visualIntentFile
  );
  if (!title || Boolean(summary && summaryFile) || Boolean(visualIntent && visualIntentFile)) {
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

function validateLanguages(
  context: ValidationContext,
  languages: NarrativeStarterLanguage[] | undefined
): void {
  if (!languages || languages.length === 0) {
    addError(
      context,
      'NARRATIVE_STARTER010',
      'At least one language is required.',
      ['languages'],
      'Add one language and mark exactly one language with isBase: true.'
    );
    return;
  }

  const seen = new Set<string>();
  for (const [index, language] of languages.entries()) {
    if (seen.has(language.localeTag)) {
      addError(
        context,
        'NARRATIVE_STARTER020',
        `Duplicate locale tag: ${language.localeTag}.`,
        ['languages', String(index), 'localeTag'],
        'Remove the duplicate language entry.'
      );
    }
    seen.add(language.localeTag);
  }

  const baseLanguages = languages.filter((language) => language.isBase === true);
  if (baseLanguages.length === 0) {
    addError(
      context,
      'NARRATIVE_STARTER021',
      'Exactly one language must have isBase: true.',
      ['languages'],
      'Mark the base language with isBase: true.'
    );
  }
  if (baseLanguages.length > 1) {
    addError(
      context,
      'NARRATIVE_STARTER022',
      'Only one language may have isBase: true.',
      ['languages'],
      'Keep isBase: true on exactly one language.'
    );
  }
}

function validateTextOrFile(
  context: ValidationContext,
  ownerPath: string[],
  fieldName: 'summary' | 'visualIntent' | 'guidance' | 'prompt' | 'description',
  scalarValue: string | undefined,
  fileValue: string | undefined
): void {
  if (scalarValue !== undefined && fileValue !== undefined) {
    addError(
      context,
      'NARRATIVE_STARTER032',
      `${formatPath([...ownerPath, fieldName])} cannot be provided as both ${fieldName} and ${fieldName}File.`,
      [...ownerPath, `${fieldName}File`],
      `Remove either ${fieldName} or ${fieldName}File.`
    );
  }
}

async function loadReferencedNarrativeMarkdown(
  starter: NarrativeStarter,
  starterPath: string,
  existingIssues: DiagnosticIssue[]
): Promise<NarrativeStarter> {
  const context: ValidationContext = {
    filePath: starterPath,
    issues: [...existingIssues],
  };
  const starterDir = path.dirname(starterPath);

  const projectSummary =
    (await readReferencedMarkdownFile(context, {
      starterDir,
      filePath: starter.project.summaryFile,
      yamlPath: ['project', 'summaryFile'],
      label: 'project summary',
    })) ?? starter.project.summary;
  await validateReferencedPngFile(context, {
    starterDir,
    filePath: starter.project.coverFile,
    yamlPath: ['project', 'coverFile'],
    label: 'project cover',
  });

  const visualLanguage = await Promise.all(
    (starter.visualLanguage ?? []).map(async (entry, index) => ({
      ...entry,
      guidance:
        (await readReferencedMarkdownFile(context, {
          starterDir,
          filePath: entry.guidanceFile,
          yamlPath: ['visualLanguage', String(index), 'guidanceFile'],
          label: `${entry.name} guidance`,
        })) ?? entry.guidance,
      prompt:
        (await readReferencedMarkdownFile(context, {
          starterDir,
          filePath: entry.promptFile,
          yamlPath: ['visualLanguage', String(index), 'promptFile'],
          label: `${entry.name} prompt`,
        })) ?? entry.prompt,
    }))
  );

  const cast = await Promise.all(
    (starter.cast ?? []).map(async (entry, index) => ({
      ...entry,
      description:
        (await readReferencedMarkdownFile(context, {
          starterDir,
          filePath: entry.descriptionFile,
          yamlPath: ['cast', String(index), 'descriptionFile'],
          label: `${entry.name} description`,
        })) ?? entry.description,
    }))
  );

  const continuityReferences = await Promise.all(
    (starter.continuityReferences ?? []).map(async (entry, index) => ({
      ...entry,
      description:
        (await readReferencedMarkdownFile(context, {
          starterDir,
          filePath: entry.descriptionFile,
          yamlPath: [
            'continuityReferences',
            String(index),
            'descriptionFile',
          ],
          label: `${entry.name} description`,
        })) ?? entry.description,
    }))
  );

  const sequences = await Promise.all(
    starter.sequences.map(async (sequence, sequenceIndex) => ({
      ...sequence,
      summary:
        (await readReferencedMarkdownFile(context, {
          starterDir,
          filePath: sequence.summaryFile,
          yamlPath: ['sequences', String(sequenceIndex), 'summaryFile'],
          label: `${sequence.title} summary`,
        })) ?? sequence.summary,
      scenes: await Promise.all(
        (sequence.scenes ?? []).map(async (scene, sceneIndex) => ({
          ...scene,
          summary:
            (await readReferencedMarkdownFile(context, {
              starterDir,
              filePath: scene.summaryFile,
              yamlPath: [
                'sequences',
                String(sequenceIndex),
                'scenes',
                String(sceneIndex),
                'summaryFile',
              ],
              label: `${scene.title} summary`,
            })) ?? scene.summary,
          clips: await Promise.all(
            (scene.clips ?? []).map(async (clip, clipIndex) => ({
              ...clip,
              summary:
                (await readReferencedMarkdownFile(context, {
                  starterDir,
                  filePath: clip.summaryFile,
                  yamlPath: [
                    'sequences',
                    String(sequenceIndex),
                    'scenes',
                    String(sceneIndex),
                    'clips',
                    String(clipIndex),
                    'summaryFile',
                  ],
                  label: `${clip.title} summary`,
                })) ?? clip.summary,
              visualIntent:
                (await readReferencedMarkdownFile(context, {
                  starterDir,
                  filePath: clip.visualIntentFile,
                  yamlPath: [
                    'sequences',
                    String(sequenceIndex),
                    'scenes',
                    String(sceneIndex),
                    'clips',
                    String(clipIndex),
                    'visualIntentFile',
                  ],
                  label: `${clip.title} visual intent`,
                })) ?? clip.visualIntent,
            }))
          ),
        }))
      ),
    }))
  );

  const result = buildDiagnosticResult(context.issues);
  throwIfDiagnosticResultInvalid(result, {
    code: 'NARRATIVE_STARTER999',
    message: 'Narrative starter YAML failed validation.',
    suggestion: 'Fix the reported narrative starter errors and run the command again.',
  });

  return {
    ...starter,
    project: {
      ...starter.project,
      summary: projectSummary,
    },
    cast,
    visualLanguage,
    continuityReferences,
    sequences,
  };
}

async function readReferencedMarkdownFile(
  context: ValidationContext,
  input: {
    starterDir: string;
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
      'NARRATIVE_STARTER030',
      `${formatPath(input.yamlPath)} must be relative to the narrative starter file.`,
      input.yamlPath,
      'Use a starter-relative Markdown path such as narrative/project-summary.md.'
    );
    return undefined;
  }
  if (path.extname(input.filePath).toLowerCase() !== '.md') {
    addError(
      context,
      'NARRATIVE_STARTER030',
      `${formatPath(input.yamlPath)} must point to a Markdown file.`,
      input.yamlPath,
      'Use a .md file for narrative text references.'
    );
    return undefined;
  }

  const resolvedPath = path.resolve(input.starterDir, input.filePath);
  const relativePath = path.relative(input.starterDir, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    addError(
      context,
      'NARRATIVE_STARTER030',
      `${formatPath(input.yamlPath)} must stay inside the narrative starter directory.`,
      input.yamlPath,
      'Move the Markdown file under the narrative starter directory and reference it with a relative path.'
    );
    return undefined;
  }

  try {
    return await fs.readFile(resolvedPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      addError(
        context,
        'NARRATIVE_STARTER031',
        `Referenced Markdown file for ${input.label} does not exist: ${input.filePath}.`,
        input.yamlPath,
        'Create the referenced Markdown file or update the narrative starter path.'
      );
      return undefined;
    }
    throw error;
  }
}

async function validateReferencedPngFile(
  context: ValidationContext,
  input: {
    starterDir: string;
    filePath?: string;
    yamlPath: string[];
    label: string;
  }
): Promise<void> {
  if (!input.filePath?.trim()) {
    return;
  }
  if (path.isAbsolute(input.filePath)) {
    addError(
      context,
      'NARRATIVE_STARTER032',
      `${formatPath(input.yamlPath)} must be relative to the narrative starter file.`,
      input.yamlPath,
      'Use a starter-relative PNG path such as sample-project/cover.png.'
    );
    return;
  }
  if (path.extname(input.filePath).toLowerCase() !== '.png') {
    addError(
      context,
      'NARRATIVE_STARTER032',
      `${formatPath(input.yamlPath)} must point to a PNG file.`,
      input.yamlPath,
      'Use a .png file for the project cover.'
    );
    return;
  }

  const resolvedPath = path.resolve(input.starterDir, input.filePath);
  const relativePath = path.relative(input.starterDir, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    addError(
      context,
      'NARRATIVE_STARTER032',
      `${formatPath(input.yamlPath)} must stay inside the narrative starter directory.`,
      input.yamlPath,
      'Move the PNG file under the narrative starter directory and reference it with a relative path.'
    );
    return;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      addError(
        context,
        'NARRATIVE_STARTER033',
        `Referenced PNG file for ${input.label} is not a file: ${input.filePath}.`,
        input.yamlPath,
        'Point project.coverFile at a PNG file.'
      );
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      addError(
        context,
        'NARRATIVE_STARTER033',
        `Referenced PNG file for ${input.label} does not exist: ${input.filePath}.`,
        input.yamlPath,
        'Create the referenced PNG file or update the narrative starter path.'
      );
      return;
    }
    throw error;
  }
}

function readArrayItems<T>(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[],
  reader: (
    context: ValidationContext,
    input: unknown,
    yamlPath: string[]
  ) => T | null
): T[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    addError(
      context,
      'NARRATIVE_STARTER011',
      `${formatPath(yamlPath)} must be an array.`,
      yamlPath
    );
    return undefined;
  }
  return input
    .map((item, index) => reader(context, item, [...yamlPath, String(index)]))
    .filter((item): item is T => item !== null);
}

function readRecord(
  context: ValidationContext,
  input: unknown,
  yamlPath: string[],
  label: string
): Record<string, unknown> | null {
  if (!isRecord(input)) {
    addError(
      context,
      'NARRATIVE_STARTER011',
      `${label} must be an object.`,
      yamlPath
    );
    return null;
  }
  return input;
}

function readRequiredString(
  context: ValidationContext,
  record: Record<string, unknown>,
  yamlPath: string[],
  message: string
): string | null {
  const value = record[yamlPath[yamlPath.length - 1]];
  if (value === undefined) {
    addError(context, 'NARRATIVE_STARTER010', message, yamlPath);
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    addError(
      context,
      'NARRATIVE_STARTER011',
      `${formatPath(yamlPath)} must be a non-empty string.`,
      yamlPath
    );
    return null;
  }
  return value;
}

function readOptionalString(
  context: ValidationContext,
  record: Record<string, unknown>,
  yamlPath: string[]
): string | undefined {
  const value = record[yamlPath[yamlPath.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    addError(
      context,
      'NARRATIVE_STARTER011',
      `${formatPath(yamlPath)} must be a string.`,
      yamlPath
    );
    return undefined;
  }
  return value;
}

function readOptionalBoolean(
  context: ValidationContext,
  record: Record<string, unknown>,
  yamlPath: string[]
): boolean | undefined {
  const value = record[yamlPath[yamlPath.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    addError(
      context,
      'NARRATIVE_STARTER011',
      `${formatPath(yamlPath)} must be a boolean.`,
      yamlPath
    );
    return undefined;
  }
  return value;
}

function warnUnknownKeys(
  context: ValidationContext,
  record: Record<string, unknown>,
  yamlPath: string[],
  allowedKeys: string[]
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (allowed.has(key)) {
      continue;
    }
    const issuePath = [...yamlPath, key];
    context.issues.push(
      createDiagnosticWarning(
        'NARRATIVE_STARTER012',
        `Unknown field ${formatPath(issuePath)} will be ignored.`,
        {
          filePath: context.filePath,
          path: issuePath,
          context: 'narrative starter YAML',
        },
        'Remove the field or rename it to a supported camelCase narrative starter field.'
      )
    );
  }
}

function addError(
  context: ValidationContext,
  code: string,
  message: string,
  yamlPath: string[],
  suggestion?: string
): void {
  context.issues.push(
    createDiagnosticError(
      code,
      message,
      {
        filePath: context.filePath,
        path: yamlPath,
        context: 'narrative starter YAML',
      },
      suggestion
    )
  );
}

function buildValidation(
  starter: NarrativeStarter | null,
  context: ValidationContext
): NarrativeStarterValidation {
  return {
    starter,
    result: buildDiagnosticResult(context.issues),
  };
}

function formatPath(yamlPath: string[]): string {
  if (yamlPath.length === 0) {
    return '<root>';
  }
  return yamlPath.reduce((label, segment) => {
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

function isValidProjectName(input: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input);
}

function isSupportedAspectRatio(input: string): boolean {
  return new Set(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9']).has(input);
}

function isVisualLanguagePriority(
  input: string
): input is NarrativeStarterVisualLanguage['priority'] {
  return input === 'default' || input === 'situational' || input === 'rare';
}

function isLikelyLocaleTag(input: string): boolean {
  return /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(input);
}
