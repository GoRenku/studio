import fs from 'node:fs/promises';
import path from 'node:path';
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
import { insertProjectLanguageRecords } from './data/project-language-records.js';
import { readProjectLibrary } from './data/project-library-reader.js';
import { readProjectFromSession } from './data/project-reader.js';
import { insertProjectRecord } from './data/project-records.js';
import { openProjectStore, type ProjectDataSession } from './data/sqlite-project-store.js';
import { insertVisualLanguageRecords } from './data/visual-language-records.js';

export interface ProjectDataService {
  createFromSetup(input: CreateProjectFromSetupInput): Promise<ProjectCreateReport>;
  listLibrary(input?: RenkuConfigPathOptions): Promise<ProjectLibrary>;
  readProject(input: ReadProjectInput): Promise<Project>;
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

export interface ResolveProjectCoverImageInput extends RenkuConfigPathOptions {
  projectName: string;
}

export function createProjectDataService(): ProjectDataService {
  return {
    createFromSetup,
    listLibrary,
    readProject,
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
      format: setup.project.format,
      baseLanguage: setup.project.baseLanguage,
      logline: setup.project.logline,
      summary: setup.project.summary,
      aspectRatio: setup.project.aspectRatio,
      resolutionWidth: setup.project.resolution?.width,
      resolutionHeight: setup.project.resolution?.height,
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
  const languages = [...(setup.languages ?? [])];
  const baseLanguage = setup.project.baseLanguage;
  if (
    baseLanguage &&
    !languages.some((language) => language.localeTag === baseLanguage)
  ) {
    languages.unshift({
      localeTag: baseLanguage,
      displayName: baseLanguage,
      isBase: true,
    });
  }
  return languages;
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
