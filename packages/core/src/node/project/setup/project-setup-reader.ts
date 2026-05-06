import fs from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { ProjectDataError } from '../../../project/index.js';

export interface ProjectSetup {
  kind: 'renku.projectSetup';
  version: '0.1.0';
  project: ProjectSetupProject;
  languages?: ProjectSetupLanguage[];
  visualLanguage?: ProjectSetupVisualLanguage[];
  cast?: ProjectSetupCastMember[];
  episodes?: ProjectSetupEpisode[];
  sequences?: ProjectSetupSequence[];
}

export interface ProjectSetupProject {
  name: string;
  title: string;
  type: 'standaloneMovie' | 'series';
  format?: string;
  baseLanguage?: string;
  logline?: string;
  summary?: string;
  aspectRatio?: string;
  resolution?: {
    width: number;
    height: number;
  };
}

export interface ProjectSetupLanguage {
  localeTag: string;
  displayName?: string;
  isBase?: boolean;
}

export interface ProjectSetupVisualLanguage {
  name: string;
  intent?: string;
  summary?: string;
}

export interface ProjectSetupCastMember {
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
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

export async function readProjectSetup(setupPath: string): Promise<ProjectSetup> {
  let parsed: unknown;
  try {
    parsed = parseYaml(await fs.readFile(setupPath, 'utf8'));
  } catch (error) {
    throw new ProjectDataError(
      'P000',
      error instanceof Error
        ? `Failed to read project setup YAML: ${error.message}`
        : 'Failed to read project setup YAML.'
    );
  }
  return validateProjectSetup(parsed);
}

export function validateProjectSetup(input: unknown): ProjectSetup {
  const root = requireRecord(input, 'project setup root');

  if (root.kind !== 'renku.projectSetup') {
    throw new ProjectDataError('P001', 'Project setup kind must be renku.projectSetup.');
  }

  if (root.version !== '0.1.0') {
    throw new ProjectDataError('P002', 'Project setup version must be 0.1.0.');
  }

  const project = readProject(root.project);
  const languages =
    root.languages === undefined
      ? undefined
      : readArray(root.languages, 'languages').map(readLanguage);
  const visualLanguage =
    root.visualLanguage === undefined
      ? undefined
      : readArray(root.visualLanguage, 'visualLanguage').map(readVisualLanguage);
  const cast =
    root.cast === undefined ? undefined : readArray(root.cast, 'cast').map(readCast);
  const episodes =
    root.episodes === undefined
      ? undefined
      : readArray(root.episodes, 'episodes').map(readEpisode);
  const sequences =
    root.sequences === undefined
      ? undefined
      : readArray(root.sequences, 'sequences').map(readSequence);

  return {
    kind: 'renku.projectSetup',
    version: '0.1.0',
    project,
    languages,
    visualLanguage,
    cast,
    episodes,
    sequences,
  };
}

function readProject(input: unknown): ProjectSetupProject {
  const record = requireRecord(input, 'project');
  const name = requireString(record, 'name', 'project.name is required.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new ProjectDataError(
      'P003',
      'project.name must be kebab-case and contain only lowercase letters, numbers, and hyphens.'
    );
  }

  const title = requireString(record, 'title', 'project.title is required.');
  const type = requireString(record, 'type', 'project.type is required.');
  if (type !== 'standaloneMovie' && type !== 'series') {
    throw new ProjectDataError(
      'P004',
      'project.type must be standaloneMovie or series.'
    );
  }

  return {
    name,
    title,
    type,
    format: optionalString(record, 'format'),
    baseLanguage: optionalString(record, 'baseLanguage'),
    logline: optionalString(record, 'logline'),
    summary: optionalString(record, 'summary'),
    aspectRatio: optionalString(record, 'aspectRatio'),
    resolution: readResolution(record.resolution),
  };
}

function readLanguage(input: unknown): ProjectSetupLanguage {
  const record = requireRecord(input, 'language');
  return {
    localeTag: requireString(record, 'localeTag', 'languages[].localeTag is required.'),
    displayName: optionalString(record, 'displayName'),
    isBase: optionalBoolean(record, 'isBase'),
  };
}

function readVisualLanguage(input: unknown): ProjectSetupVisualLanguage {
  const record = requireRecord(input, 'visualLanguage');
  return {
    name: requireString(record, 'name', 'visualLanguage[].name is required.'),
    intent: optionalString(record, 'intent'),
    summary: optionalString(record, 'summary'),
  };
}

function readCast(input: unknown): ProjectSetupCastMember {
  const record = requireRecord(input, 'cast');
  return {
    name: requireString(record, 'name', 'cast[].name is required.'),
    kind: optionalString(record, 'kind'),
    role: optionalString(record, 'role'),
    shortDescription: optionalString(record, 'shortDescription'),
  };
}

function readEpisode(input: unknown): ProjectSetupEpisode {
  const record = requireRecord(input, 'episode');
  return {
    title: requireString(record, 'title', 'episodes[].title is required.'),
    shortTitle: optionalString(record, 'shortTitle'),
    episodeNumber: optionalNumber(record, 'episodeNumber'),
    summary: optionalString(record, 'summary'),
    sequences:
      record.sequences === undefined
        ? undefined
        : readArray(record.sequences, 'episodes[].sequences').map(readSequence),
  };
}

function readSequence(input: unknown): ProjectSetupSequence {
  const record = requireRecord(input, 'sequence');
  return {
    title: requireString(record, 'title', 'sequences[].title is required.'),
    shortTitle: optionalString(record, 'shortTitle'),
    summary: optionalString(record, 'summary'),
    scenes:
      record.scenes === undefined
        ? undefined
        : readArray(record.scenes, 'sequences[].scenes').map(readScene),
  };
}

function readScene(input: unknown): ProjectSetupScene {
  const record = requireRecord(input, 'scene');
  return {
    title: requireString(record, 'title', 'scenes[].title is required.'),
    summary: optionalString(record, 'summary'),
    clips:
      record.clips === undefined
        ? undefined
        : readArray(record.clips, 'scenes[].clips').map(readClip),
  };
}

function readClip(input: unknown): ProjectSetupClip {
  const record = requireRecord(input, 'clip');
  return {
    title: requireString(record, 'title', 'clips[].title is required.'),
    summary: optionalString(record, 'summary'),
    visualIntent: optionalString(record, 'visualIntent'),
  };
}

function readResolution(input: unknown): ProjectSetupProject['resolution'] {
  if (input === undefined) {
    return undefined;
  }
  const record = requireRecord(input, 'project.resolution');
  return {
    width: requireNumber(record, 'width', 'project.resolution.width is required.'),
    height: requireNumber(record, 'height', 'project.resolution.height is required.'),
  };
}

function requireRecord(input: unknown, label: string): Record<string, unknown> {
  if (!isRecord(input)) {
    throw new ProjectDataError('P005', `${label} must be an object.`);
  }
  return input;
}

function readArray(input: unknown, label: string): unknown[] {
  if (!Array.isArray(input)) {
    throw new ProjectDataError('P006', `${label} must be an array.`);
  }
  return input;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  message: string
): string {
  return requirePlainString(record[key], message);
}

function requirePlainString(input: unknown, message: string): string {
  if (typeof input !== 'string' || !input.trim()) {
    throw new ProjectDataError('P007', message);
  }
  return input;
}

function optionalString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ProjectDataError('P008', `${key} must be a string.`);
  }
  return value;
}

function optionalBoolean(
  record: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new ProjectDataError('P009', `${key} must be a boolean.`);
  }
  return value;
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string
): number | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProjectDataError('P010', `${key} must be a number.`);
  }
  return value;
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  message: string
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProjectDataError('P011', message);
  }
  return value;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
