import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  Project,
  ProjectCounts,
  ProjectCreateReport,
  ProjectLibrary,
} from '../../project/index.js';
import { ProjectDataError } from '../../project/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../config.js';
import {
  copyProjectCoverImage,
  resolveProjectCoverImage as resolveProjectCoverImageFile,
} from './files/cover-image-files.js';
import {
  PROJECT_COVER_IMAGE_FILE,
  RENKU_PROJECT_DIR,
  resolveProjectDatabasePath,
  resolveProjectFolder,
} from './files/project-paths.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type EntityIdPrefix,
  type ProjectIdGenerator,
} from './ids/project-id-generator.js';
import {
  readProjectSetupOrThrow,
  type ProjectSetup,
  type ProjectSetupLanguage,
  type ProjectSetupSequence,
} from './setup/project-setup-reader.js';
import { insertCastMemberRecords } from './data/cast-member-records.js';
import {
  insertClipRecord,
  insertEpisodeRecord,
  insertSceneRecord,
  insertSequenceRecord,
} from './data/narrative-records.js';
import {
  insertProjectLanguageRecords,
  listProjectLanguageRecords,
  replaceProjectLanguageRecords,
} from './data/project-language-records.js';
import { readProjectLibrary } from './data/project-library-reader.js';
import { readProjectFromSession } from './data/project-reader.js';
import {
  insertProjectRecord,
  readProjectRecord,
  updateProjectInformationRecord,
} from './data/project-records.js';
import { openProjectStore, type ProjectDataSession } from './data/sqlite-project-store.js';
import { insertVisualLanguageRecords } from './data/visual-language-records.js';

export interface ProjectDataService {
  createFromSetup(input: CreateProjectFromSetupInput): Promise<ProjectCreateReport>;
  listLibrary(input?: RenkuConfigPathOptions): Promise<ProjectLibrary>;
  readProject(input: ReadProjectInput): Promise<Project>;
  updateProjectInformation(input: UpdateProjectInformationInput): Promise<Project>;
  resolveCoverImage(input: ResolveProjectCoverImageInput): Promise<string | null>;
}

export interface CreateProjectFromSetupInput extends RenkuConfigPathOptions {
  setupPath: string;
  coverPath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ReadProjectInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface UpdateProjectInformationInput extends RenkuConfigPathOptions {
  projectName: string;
  information: ProjectInformationUpdate;
}

export interface ProjectInformationUpdate {
  title: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string;
  languages: ProjectInformationLanguageUpdate[];
}

export interface ProjectInformationLanguageUpdate {
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}

export interface ResolveProjectCoverImageInput extends RenkuConfigPathOptions {
  projectName: string;
}

export function createProjectDataService(): ProjectDataService {
  return {
    createFromSetup,
    listLibrary,
    readProject,
    updateProjectInformation,
    resolveCoverImage,
  };
}

async function createFromSetup(
  input: CreateProjectFromSetupInput
): Promise<ProjectCreateReport> {
  const setupResult = await readProjectSetupOrThrow(input.setupPath);
  const setup = setupResult.setup;
  const storageRoot = await resolveRenkuStorageRoot(input);
  await fs.mkdir(storageRoot, { recursive: true });

  const projectFolder = resolveProjectFolder(storageRoot, setup.project.name);
  if (await pathExists(projectFolder)) {
    throw new ProjectDataError(
      'PROJECT_DATA024',
      `Project folder already exists: ${projectFolder}`
    );
  }

  await fs.mkdir(path.join(projectFolder, RENKU_PROJECT_DIR), { recursive: true });
  const session = openProjectStore({ projectFolder, create: true });
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );

  try {
    const now = new Date().toISOString();
    const coverFile = input.coverPath ? PROJECT_COVER_IMAGE_FILE : null;
    const counts = writeSetupRecords(session, setup, ids, now, coverFile);
    const coverPath = await copyProjectCoverImage({
      coverPath: input.coverPath,
      projectFolder,
    });

    return {
      projectName: setup.project.name,
      projectPath: projectFolder,
      databasePath: resolveProjectDatabasePath(projectFolder),
      coverPath,
      created: counts,
      warnings: setupResult.warnings,
    };
  } finally {
    session.close();
  }
}

async function listLibrary(input: RenkuConfigPathOptions = {}): Promise<ProjectLibrary> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  return await readProjectLibrary({ storageRoot });
}

async function readProject(input: ReadProjectInput): Promise<Project> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({ projectFolder, create: false });
  try {
    return readProjectFromSession({ session, projectFolder });
  } finally {
    session.close();
  }
}

async function updateProjectInformation(
  input: UpdateProjectInformationInput
): Promise<Project> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({ projectFolder, create: false });
  try {
    const projectRecord = readProjectRecord(session);
    if (!projectRecord) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }

    validateProjectInformationUpdate(input.information);
    const now = new Date().toISOString();
    const existingLanguageIds = new Map(
      listProjectLanguageRecords(session).map((language) => [
        language.localeTag,
        language.id,
      ])
    );
    const ids = createUniqueIdAllocator(createRandomIdGenerator());

    const transaction = session.sqlite.transaction(() => {
      updateProjectInformationRecord(session, projectRecord.id, {
        title: input.information.title.trim(),
        aspectRatio: input.information.aspectRatio,
        logline: optionalTrimmed(input.information.logline),
        summary: optionalTrimmed(input.information.summary),
        updatedAt: now,
      });
      replaceProjectLanguageRecords(
        session,
        input.information.languages.map((language, index) => ({
          id: existingLanguageIds.get(language.localeTag) ?? ids('language'),
          localeTag: language.localeTag,
          displayName: optionalTrimmed(language.displayName),
          isBase: language.isBase,
          supportsAudio: language.supportsAudio,
          supportsSubtitles: language.supportsSubtitles,
          position: index + 1,
        }))
      );
    });

    transaction();
    return readProjectFromSession({ session, projectFolder });
  } finally {
    session.close();
  }
}

async function resolveCoverImage(
  input: ResolveProjectCoverImageInput
): Promise<string | null> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const project = await readProject(input);
  return await resolveProjectCoverImageFile({
    storageRoot,
    projectName: input.projectName,
    coverFile: project.coverImage?.fileName ?? null,
  });
}

function writeSetupRecords(
  session: ProjectDataSession,
  setup: ProjectSetup,
  ids: (prefix: EntityIdPrefix) => string,
  now: string,
  coverFile: string | null
): ProjectCounts {
  const transaction = session.sqlite.transaction(() => {
    const projectId = ids('project');
    insertProjectRecord(session, {
      id: projectId,
      name: setup.project.name,
      title: setup.project.title,
      type: setup.project.type,
      logline: setup.project.logline,
      summary: setup.project.summary,
      aspectRatio: setup.project.aspectRatio,
      coverFile,
      createdAt: now,
      updatedAt: now,
    });

    const languages = expandLanguages(setup);
    insertProjectLanguageRecords(
      session,
      languages.map((language, index) => ({
        id: ids('language'),
        localeTag: language.localeTag,
        displayName: language.displayName,
        isBase: language.isBase ?? false,
        supportsAudio: language.supportsAudio ?? true,
        supportsSubtitles: language.supportsSubtitles ?? true,
        position: index + 1,
      }))
    );

    insertVisualLanguageRecords(
      session,
      (setup.visualLanguage ?? []).map((entry, index) => ({
        id: ids('visual_language'),
        name: entry.name,
        intent: entry.intent,
        summary: entry.summary,
        position: index + 1,
      }))
    );

    insertCastMemberRecords(
      session,
      (setup.cast ?? []).map((castMember, index) => ({
        id: ids('cast'),
        name: castMember.name,
        kind: castMember.kind,
        role: castMember.role,
        shortDescription: castMember.shortDescription,
        position: index + 1,
      }))
    );

    const counts: ProjectCounts = {
      languages: languages.length,
      visualLanguage: setup.visualLanguage?.length ?? 0,
      castMembers: setup.cast?.length ?? 0,
      episodes: setup.episodes?.length ?? 0,
      sequences: 0,
      scenes: 0,
      clips: 0,
    };

    (setup.episodes ?? []).forEach((episode, index) => {
      const episodeId = ids('episode');
      insertEpisodeRecord(session, {
        id: episodeId,
        title: episode.title,
        shortTitle: episode.shortTitle,
        episodeNumber: episode.episodeNumber,
        summary: episode.summary,
        position: index + 1,
      });
      writeSequences(session, episode.sequences ?? [], episodeId, ids, counts);
    });

    writeSequences(session, setup.sequences ?? [], null, ids, counts);
    return counts;
  });

  return transaction();
}

function writeSequences(
  session: ProjectDataSession,
  input: ProjectSetupSequence[],
  episodeId: string | null,
  ids: (prefix: EntityIdPrefix) => string,
  counts: ProjectCounts
): void {
  input.forEach((sequence) => {
    const sequenceId = ids('sequence');
    counts.sequences += 1;
    insertSequenceRecord(session, {
      id: sequenceId,
      episodeId,
      title: sequence.title,
      shortTitle: sequence.shortTitle,
      summary: sequence.summary,
      position: counts.sequences,
    });

    (sequence.scenes ?? []).forEach((scene, sceneIndex) => {
      const sceneId = ids('scene');
      counts.scenes += 1;
      insertSceneRecord(session, {
        id: sceneId,
        sequenceId,
        title: scene.title,
        summary: scene.summary,
        position: sceneIndex + 1,
      });

      (scene.clips ?? []).forEach((clip, clipIndex) => {
        counts.clips += 1;
        insertClipRecord(session, {
          id: ids('clip'),
          sceneId,
          title: clip.title,
          summary: clip.summary,
          visualIntent: clip.visualIntent,
          position: clipIndex + 1,
        });
      });
    });
  });
}

function expandLanguages(setup: ProjectSetup): ProjectSetupLanguage[] {
  return [...(setup.languages ?? [])];
}

function validateProjectInformationUpdate(update: ProjectInformationUpdate): void {
  const issues: DiagnosticIssue[] = [];
  const supportedAspectRatios = new Set([
    '1:1',
    '3:4',
    '4:3',
    '16:9',
    '9:16',
    '21:9',
  ]);
  const supportedLocaleTags = new Set([
    'en-US',
    'es-ES',
    'de-DE',
    'fr-FR',
    'zh-CN',
    'ja-JP',
    'tr-TR',
  ]);

  if (!update.title.trim()) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA050',
        'Project title is required.',
        { path: ['title'], context: 'project information update' },
        'Enter a project title before saving.'
      )
    );
  }

  if (
    update.aspectRatio !== undefined &&
    !supportedAspectRatios.has(update.aspectRatio)
  ) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA051',
        'Project aspect ratio is not supported.',
        { path: ['aspectRatio'], context: 'project information update' },
        'Choose one of 1:1, 3:4, 4:3, 16:9, 9:16, or 21:9.'
      )
    );
  }

  if (update.languages.length === 0) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA052',
        'At least one project language is required.',
        { path: ['languages'], context: 'project information update' },
        'Add at least one language.'
      )
    );
  }

  const seenLocaleTags = new Set<string>();
  let baseLanguageCount = 0;
  update.languages.forEach((language, index) => {
    const languagePath = ['languages', String(index)];
    if (!supportedLocaleTags.has(language.localeTag)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA053',
          `Language ${language.localeTag} is not in the supported project language catalog.`,
          { path: [...languagePath, 'localeTag'], context: 'project information update' },
          'Choose a language from the Studio language dropdown.'
        )
      );
    }
    if (seenLocaleTags.has(language.localeTag)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA054',
          `Language ${language.localeTag} appears more than once.`,
          { path: [...languagePath, 'localeTag'], context: 'project information update' },
          'Keep only one row for each locale tag.'
        )
      );
    }
    seenLocaleTags.add(language.localeTag);
    if (language.isBase) {
      baseLanguageCount += 1;
    }
  });

  if (baseLanguageCount !== 1) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA055',
        'Exactly one project language must be marked as base.',
        { path: ['languages'], context: 'project information update' },
        'Choose one base language.'
      )
    );
  }

  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throw new ProjectDataError(
      'PROJECT_DATA056',
      'Project information failed validation.',
      {
        issues: result.issues,
        suggestion: 'Fix the highlighted project information fields and save again.',
      }
    );
  }
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
