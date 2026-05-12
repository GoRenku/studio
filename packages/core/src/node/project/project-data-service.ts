import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  Asset,
  AssetLocaleContext,
  AssetTarget,
  MarkdownAssetContent,
  Project,
  ProjectCounts,
  ProjectCreateReport,
  ProjectLibrary,
  ProductionExportInput,
  ProductionExportSummary,
  RegisterAssetInput,
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
  readMarkdownAssetFile,
  writeMarkdownAssetFile,
} from './files/markdown-asset-files.js';
import {
  allocateWorkingMarkdownAssetPath,
  WORKING_ASSETS_BASE_ROOT,
  type MarkdownAssetPathTarget,
} from './files/project-asset-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
  type ProjectRelativePath,
} from './files/project-relative-paths.js';
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
import {
  readNarrativeStarterOrThrow,
  type NarrativeStarter,
} from './narrative-starter/index.js';
import { insertCastMemberRecords } from './data/cast-member-records.js';
import { listCastAssetRecords } from './data/cast-asset-records.js';
import {
  insertContinuityReferenceAssetRecord,
  listContinuityReferenceAssetRecords,
} from './data/continuity-reference-asset-records.js';
import { insertContinuityReferenceRecords } from './data/continuity-reference-records.js';
import {
  insertAssetFileRecord,
  listAssetFileRecords,
  readAssetFileRecord,
  updateAssetFileRecordMetadata,
} from './data/asset-file-records.js';
import {
  insertAssetRecord,
  readAssetRecord,
  updateAssetRecordUpdatedAt,
} from './data/asset-records.js';
import {
  insertClipRecord,
  insertEpisodeRecord,
  insertSceneRecord,
  insertSequenceRecord,
} from './data/narrative-records.js';
import {
  insertProjectLocaleRecords,
  listProjectLocaleRecords,
  type ProjectLocaleRecord,
  replaceProjectLocaleRecords,
} from './data/project-locale-records.js';
import {
  insertProjectAssetRecord,
  listProjectAssetRecords,
} from './data/project-asset-records.js';
import { readProjectLibrary } from './data/project-library-reader.js';
import { readProjectFromSession } from './data/project-reader.js';
import {
  insertProjectRecord,
  readProjectRecord,
  updateProjectInformationRecord,
} from './data/project-records.js';
import { openProjectStore, type ProjectDataSession } from './data/sqlite-project-store.js';
import {
  insertVisualLanguageAssetRecord,
  listVisualLanguageAssetRecords,
} from './data/visual-language-asset-records.js';
import { insertVisualLanguageCategoryRecords } from './data/visual-language-category-records.js';
import { insertVisualLanguageRecords } from './data/visual-language-records.js';
import {
  insertClipAssetRecord,
  listClipAssetRecords,
  listSceneAssetRecords,
  listSequenceAssetRecords,
  insertSceneAssetRecord,
  insertSequenceAssetRecord,
} from './data/narrative-asset-records.js';
import {
  createAssetSelect,
  listAssetSelects,
  listAssets,
  registerAsset,
  removeAssetSelect,
  updateAssetSelect,
} from './assets/asset-service.js';
import { exportProductionAssets } from './production-export/production-export-service.js';

export interface ProjectDataService {
  createFromSetup(input: CreateProjectFromSetupInput): Promise<ProjectCreateReport>;
  createFromNarrativeStarter(
    input: CreateProjectFromNarrativeStarterInput
  ): Promise<ProjectCreateReport>;
  listLibrary(input?: RenkuConfigPathOptions): Promise<ProjectLibrary>;
  readProject(input: ReadProjectInput): Promise<Project>;
  updateProjectInformation(input: UpdateProjectInformationInput): Promise<Project>;
  patchProjectInformation(input: PatchProjectInformationInput): Promise<Project>;
  readMarkdownAssetContent(
    input: ReadMarkdownAssetContentInput
  ): Promise<MarkdownAssetContent>;
  updateMarkdownAssetContent(
    input: UpdateMarkdownAssetContentInput
  ): Promise<UpdateMarkdownAssetContentResult>;
  resolveCoverImage(input: ResolveProjectCoverImageInput): Promise<string | null>;
  registerAsset(input: RegisterAssetInput & RenkuConfigPathOptions): Promise<Asset>;
  listAssets(input: ListAssetsInput): Promise<Asset[]>;
  createAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  updateAssetSelect(input: ChangeAssetSelectInput): Promise<Asset>;
  removeAssetSelect(input: RemoveAssetSelectInput): Promise<Asset>;
  listAssetSelects(input: ListAssetsInput): Promise<Asset[]>;
  exportProductionAssets(
    input: ProductionExportInput & RenkuConfigPathOptions
  ): Promise<ProductionExportSummary>;
}

export interface CreateProjectFromSetupInput extends RenkuConfigPathOptions {
  setupPath: string;
  coverPath?: string;
  idGenerator?: ProjectIdGenerator;
}

export interface CreateProjectFromNarrativeStarterInput
  extends RenkuConfigPathOptions {
  starterPath: string;
  idGenerator?: ProjectIdGenerator;
}

export interface ReadProjectInput extends RenkuConfigPathOptions {
  projectName: string;
}

export interface UpdateProjectInformationInput extends RenkuConfigPathOptions {
  projectName: string;
  information: ProjectInformationUpdate;
}

export interface PatchProjectInformationInput extends RenkuConfigPathOptions {
  projectName: string;
  patch: ProjectInformationPatch;
}

export interface ReadMarkdownAssetContentInput extends RenkuConfigPathOptions {
  projectName: string;
  assetId: string;
  assetFileId: string;
}

export interface UpdateMarkdownAssetContentInput
  extends ReadMarkdownAssetContentInput {
  content: string;
}

export interface UpdateMarkdownAssetContentResult {
  content: MarkdownAssetContent;
  project: Project;
}

export interface ProjectInformationPatch {
  title?: string;
  aspectRatio?: string | null;
  logline?: string | null;
  summary?: string | null;
  languages?: ProjectLanguagePatchOperation[];
}

export type ProjectLanguagePatchOperation =
  | {
      operation: 'add';
      localeTag: string;
      displayName?: string;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | {
      operation: 'update';
      localeTag: string;
      displayName?: string | null;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | { operation: 'remove'; localeTag: string }
  | { operation: 'setBase'; localeTag: string };

export interface ProjectInformationUpdate {
  title: string;
  aspectRatio?: string;
  logline?: string;
  summary?: string | null;
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

export interface ListAssetsInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  locale?: AssetLocaleContext;
}

export interface ChangeAssetSelectInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
  selectionOrder?: number;
}

export interface RemoveAssetSelectInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  assetId: string;
}

export function createProjectDataService(): ProjectDataService {
  return {
    createFromSetup,
    createFromNarrativeStarter,
    listLibrary,
    readProject,
    updateProjectInformation,
    patchProjectInformation,
    readMarkdownAssetContent,
    updateMarkdownAssetContent,
    resolveCoverImage,
    registerAsset,
    listAssets,
    createAssetSelect,
    updateAssetSelect,
    removeAssetSelect,
    listAssetSelects,
    exportProductionAssets,
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
    const counts = await writeSetupRecords(
      session,
      setup,
      ids,
      now,
      coverFile,
      projectFolder
    );
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

async function createFromNarrativeStarter(
  input: CreateProjectFromNarrativeStarterInput
): Promise<ProjectCreateReport> {
  const starterResult = await readNarrativeStarterOrThrow(input.starterPath);
  const setup = projectSetupFromNarrativeStarter(starterResult.starter);
  const storageRoot = await resolveRenkuStorageRoot(input);
  await fs.mkdir(storageRoot, { recursive: true });

  const projectFolder = resolveProjectFolder(storageRoot, setup.project.name);
  if (await pathExists(projectFolder)) {
    throw new ProjectDataError(
      'NARRATIVE_STARTER050',
      `Project folder already exists: ${projectFolder}`,
      {
        issues: [
          createDiagnosticError(
            'NARRATIVE_STARTER050',
            `Project folder already exists: ${projectFolder}`,
            {
              filePath: input.starterPath,
              path: ['project', 'name'],
              context: 'narrative starter YAML',
            },
            'Choose a different project.name or remove the existing project folder.'
          ),
        ],
        suggestion:
          'Choose a different project name or remove the existing project folder.',
      }
    );
  }

  await fs.mkdir(path.join(projectFolder, RENKU_PROJECT_DIR), { recursive: true });
  const session = openProjectStore({ projectFolder, create: true });
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  const starterCoverPath = starterResult.starter.project.coverFile
    ? path.resolve(
        path.dirname(input.starterPath),
        starterResult.starter.project.coverFile
      )
    : undefined;

  try {
    const now = new Date().toISOString();
    const coverFile = starterCoverPath ? PROJECT_COVER_IMAGE_FILE : null;
    const counts = await writeSetupRecords(
      session,
      setup,
      ids,
      now,
      coverFile,
      projectFolder
    );
    const coverPath = await copyProjectCoverImage({
      coverPath: starterCoverPath,
      projectFolder,
    });

    return {
      projectName: setup.project.name,
      projectPath: projectFolder,
      databasePath: resolveProjectDatabasePath(projectFolder),
      coverPath,
      created: counts,
      warnings: starterResult.warnings,
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
    const existingLocales = listProjectLocaleRecords(session);
    const existingLocaleIds = new Map(
      existingLocales.map((language) => [
        language.localeTag,
        language.id,
      ])
    );
    const ids = createUniqueIdAllocator(createRandomIdGenerator());
    const nextLocaleIds = new Set(
      input.information.languages.map((language) => existingLocaleIds.get(language.localeTag))
    );
    assertRemovedLocalesAreUnused(
      session,
      existingLocales.filter((locale) => !nextLocaleIds.has(locale.id))
    );

    const transaction = session.sqlite.transaction(() => {
      updateProjectInformationRecord(session, projectRecord.id, {
        title: input.information.title.trim(),
        aspectRatio: input.information.aspectRatio,
        logline: nullableTrimmed(input.information.logline),
        updatedAt: now,
      });
      replaceProjectLocaleRecords(
        session,
        input.information.languages.map((language, index) => ({
          id: existingLocaleIds.get(language.localeTag) ?? ids('locale'),
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
    if (input.information.summary !== undefined) {
      await updateExistingProjectSummaryAsset({
        session,
        projectFolder,
        content: nullableTrimmed(input.information.summary) ?? '',
        ids,
        now,
      });
    }
    return readProjectFromSession({ session, projectFolder });
  } finally {
    session.close();
  }
}

async function patchProjectInformation(
  input: PatchProjectInformationInput
): Promise<Project> {
  const current = await readProject(input);
  const information = applyProjectInformationPatch(current, input.patch);
  return await updateProjectInformation({
    projectName: input.projectName,
    homeDir: input.homeDir,
    information,
  });
}

async function readMarkdownAssetContent(
  input: ReadMarkdownAssetContentInput
): Promise<MarkdownAssetContent> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({ projectFolder, create: false });
  try {
    const file = readMarkdownAssetFileRecord(session, input);
    return {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      projectRelativePath: file.projectRelativePath,
      content: await readMarkdownAssetFile({
        projectFolder,
        projectRelativePath: normalizeProjectRelativePath(file.projectRelativePath),
      }),
    };
  } finally {
    session.close();
  }
}

async function updateMarkdownAssetContent(
  input: UpdateMarkdownAssetContentInput
): Promise<UpdateMarkdownAssetContentResult> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({ projectFolder, create: false });
  try {
    const file = readMarkdownAssetFileRecord(session, input);
    const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
    await writeMarkdownAssetFile({
      projectFolder,
      projectRelativePath,
      content: input.content,
    });

    const absolutePath = resolveProjectRelativePath(projectFolder, projectRelativePath);
    const stats = await fs.stat(absolutePath);
    const now = new Date().toISOString();
    const transaction = session.sqlite.transaction(() => {
      updateAssetRecordUpdatedAt(session, {
        assetId: input.assetId,
        updatedAt: now,
      });
      updateAssetFileRecordMetadata(session, {
        assetId: input.assetId,
        assetFileId: input.assetFileId,
        sizeBytes: stats.size,
        updatedAt: now,
      });
    });
    transaction();

    return {
      content: {
        assetId: input.assetId,
        assetFileId: input.assetFileId,
        projectRelativePath,
        content: await readMarkdownAssetFile({
          projectFolder,
          projectRelativePath,
        }),
      },
      project: readProjectFromSession({ session, projectFolder }),
    };
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

async function writeSetupRecords(
  session: ProjectDataSession,
  setup: ProjectSetup,
  ids: (prefix: EntityIdPrefix) => string,
  now: string,
  coverFile: string | null,
  projectFolder: string
): Promise<ProjectCounts> {
  const markdownAssets: SetupMarkdownAsset[] = [];
  const localeRecords = expandLanguages(setup).map((language, index) => ({
    id: ids('locale'),
    localeTag: language.localeTag,
    displayName: language.displayName,
    isBase: language.isBase ?? false,
    supportsAudio: language.supportsAudio ?? true,
    supportsSubtitles: language.supportsSubtitles ?? true,
    position: index + 1,
  }));
  const baseLocaleId =
    localeRecords.find((language) => language.isBase)?.id ??
    localeRecords[0]?.id ??
    null;

  const projectId = ids('project');
  addMarkdownAsset(markdownAssets, ids, now, {
    content: setup.project.summary,
    title: `${setup.project.title} summary`,
    role: 'summary',
    localeId: baseLocaleId,
    pathTarget: { kind: 'project' },
    fileName: 'project-summary.md',
    relationship: { kind: 'project' },
  });

  const visualLanguageCategoryRecords = buildVisualLanguageCategoryRecords({
    setup,
    ids,
    now,
  });
  const visualLanguageCategoryIds = new Map(
    visualLanguageCategoryRecords.map((category) => [category.name, category.id])
  );

  const visualLanguageRecords = (setup.visualLanguage ?? []).map((entry, index) => {
    const visualLanguageId = ids('visual_language');
    const slug = numberedSlug(index + 1, entry.name);
    const categoryId = visualLanguageCategoryIds.get(entry.category);
    if (!categoryId) {
      throw new ProjectDataError(
        'PROJECT_DATA064',
        `Visual language category ${entry.category} was not created.`
      );
    }
    addMarkdownAsset(markdownAssets, ids, now, {
      content: entry.guidance,
      title: `${entry.name} guidance`,
      role: 'guidance',
      localeId: baseLocaleId,
      pathTarget: {
        kind: 'visualLanguage',
        categorySlug: slugify(entry.category),
        slug,
      },
      fileName: 'guidance.md',
      relationship: {
        kind: 'visualLanguage',
        visualLanguageId,
      },
    });
    addMarkdownAsset(markdownAssets, ids, now, {
      content: entry.prompt,
      title: `${entry.name} prompt`,
      role: 'prompt',
      localeId: baseLocaleId,
      pathTarget: {
        kind: 'visualLanguage',
        categorySlug: slugify(entry.category),
        slug,
      },
      fileName: 'prompt.md',
      relationship: {
        kind: 'visualLanguage',
        visualLanguageId,
      },
    });
    return {
      id: visualLanguageId,
      categoryId,
      name: entry.name,
      oneLineSummary: entry.shortDescription,
      priority: entry.priority,
      position: index + 1,
      createdAt: now,
      updatedAt: now,
    };
  });

  const castMemberRecords = (setup.cast ?? []).map((castMember, index) => ({
    id: ids('cast'),
    name: castMember.name,
    kind: castMember.kind,
    role: castMember.role,
    shortDescription: castMember.shortDescription,
    position: index + 1,
    createdAt: now,
    updatedAt: now,
  }));
  const workspaceFolders = buildSetupWorkspaceFolders({
    setup,
    castMemberRecords,
  });

  const continuityReferenceRecords = (setup.continuityReferences ?? []).map(
    (entry, index) => {
      const continuityReferenceId = ids('continuity_reference');
      addMarkdownAsset(markdownAssets, ids, now, {
        content: entry.description,
        title: `${entry.name} description`,
        role: 'description',
        localeId: baseLocaleId,
        pathTarget: {
          kind: 'continuityReference',
          kindSlug: slugify(entry.kind),
          slug: numberedSlug(index + 1, entry.name),
        },
        fileName: 'description.md',
        relationship: {
          kind: 'continuityReference',
          continuityReferenceId,
        },
      });
      return {
        id: continuityReferenceId,
        kind: entry.kind,
        name: entry.name,
        oneLineSummary: entry.shortDescription,
        position: index + 1,
        createdAt: now,
        updatedAt: now,
      };
    }
  );

  const episodeRecords: Parameters<typeof insertEpisodeRecord>[1][] = [];
  const sequenceRecords: Parameters<typeof insertSequenceRecord>[1][] = [];
  const sceneRecords: Parameters<typeof insertSceneRecord>[1][] = [];
  const clipRecords: Parameters<typeof insertClipRecord>[1][] = [];

  const counts: ProjectCounts = {
    languages: localeRecords.length,
    visualLanguageCategories: visualLanguageCategoryRecords.length,
    visualLanguage: visualLanguageRecords.length,
    castMembers: castMemberRecords.length,
    continuityReferences: continuityReferenceRecords.length,
    episodes: setup.episodes?.length ?? 0,
    sequences: 0,
    scenes: 0,
    clips: 0,
  };

  (setup.episodes ?? []).forEach((episode, index) => {
    const episodeId = ids('episode');
    episodeRecords.push({
      id: episodeId,
      title: episode.title,
      shortTitle: episode.shortTitle,
      episodeNumber: episode.episodeNumber,
      oneLineSummary: episode.summary,
      position: index + 1,
      createdAt: now,
      updatedAt: now,
    });
    writeSequences({
      input: episode.sequences ?? [],
      episodeId,
      ids,
      counts,
      now,
      baseLocaleId,
      markdownAssets,
      sequenceRecords,
      sceneRecords,
      clipRecords,
    });
  });

  writeSequences({
    input: setup.sequences ?? [],
    episodeId: null,
    ids,
    counts,
    now,
    baseLocaleId,
    markdownAssets,
    sequenceRecords,
    sceneRecords,
    clipRecords,
  });

  await Promise.all(
    markdownAssets.map((asset) =>
      writeMarkdownAssetFile({
        projectFolder,
        projectRelativePath: asset.projectRelativePath,
        content: asset.content,
      })
    )
  );
  await ensureProjectFolders(projectFolder, workspaceFolders);

  const transaction = session.sqlite.transaction(() => {
    insertProjectRecord(session, {
      id: projectId,
      name: setup.project.name,
      title: setup.project.title,
      type: setup.project.type,
      logline: setup.project.logline,
      aspectRatio: setup.project.aspectRatio,
      coverFile,
      createdAt: now,
      updatedAt: now,
    });

    insertProjectLocaleRecords(session, localeRecords);
    insertVisualLanguageCategoryRecords(session, visualLanguageCategoryRecords);
    insertVisualLanguageRecords(session, visualLanguageRecords);
    insertCastMemberRecords(session, castMemberRecords);
    insertContinuityReferenceRecords(session, continuityReferenceRecords);
    for (const record of episodeRecords) {
      insertEpisodeRecord(session, record);
    }
    for (const record of sequenceRecords) {
      insertSequenceRecord(session, record);
    }
    for (const record of sceneRecords) {
      insertSceneRecord(session, record);
    }
    for (const record of clipRecords) {
      insertClipRecord(session, record);
    }
    for (const asset of markdownAssets) {
      insertMarkdownAssetRecords(session, asset);
    }
    return counts;
  });

  return transaction();
}

function writeSequences(input: {
  input: ProjectSetupSequence[];
  episodeId: string | null;
  ids: (prefix: EntityIdPrefix) => string;
  counts: ProjectCounts;
  now: string;
  baseLocaleId: string | null;
  markdownAssets: SetupMarkdownAsset[];
  sequenceRecords: Parameters<typeof insertSequenceRecord>[1][];
  sceneRecords: Parameters<typeof insertSceneRecord>[1][];
  clipRecords: Parameters<typeof insertClipRecord>[1][];
}): void {
  input.input.forEach((sequence) => {
    const sequenceId = input.ids('sequence');
    input.counts.sequences += 1;
    const sequenceSlug = numberedSlug(input.counts.sequences, sequence.title);
    input.sequenceRecords.push({
      id: sequenceId,
      episodeId: input.episodeId,
      title: sequence.title,
      shortTitle: sequence.shortTitle,
      oneLineSummary: undefined,
      position: input.counts.sequences,
      createdAt: input.now,
      updatedAt: input.now,
    });
    addMarkdownAsset(input.markdownAssets, input.ids, input.now, {
      content: sequence.summary,
      title: `${sequence.title} summary`,
      role: 'summary',
      localeId: input.baseLocaleId,
      pathTarget: { kind: 'sequence', sequenceSlug },
      fileName: 'sequence-summary.md',
      relationship: { kind: 'sequence', sequenceId },
    });

    (sequence.scenes ?? []).forEach((scene, sceneIndex) => {
      const sceneId = input.ids('scene');
      input.counts.scenes += 1;
      const sceneSlug = numberedSlug(sceneIndex + 1, scene.title);
      input.sceneRecords.push({
        id: sceneId,
        sequenceId,
        title: scene.title,
        oneLineSummary: undefined,
        position: sceneIndex + 1,
        createdAt: input.now,
        updatedAt: input.now,
      });
      addMarkdownAsset(input.markdownAssets, input.ids, input.now, {
        content: scene.summary,
        title: `${scene.title} summary`,
        role: 'summary',
        localeId: input.baseLocaleId,
        pathTarget: { kind: 'scene', sequenceSlug, sceneSlug },
        fileName: 'scene-summary.md',
        relationship: { kind: 'scene', sceneId },
      });

      (scene.clips ?? []).forEach((clip, clipIndex) => {
        input.counts.clips += 1;
        const clipId = input.ids('clip');
        const clipSlug = numberedSlug(clipIndex + 1, clip.title);
        input.clipRecords.push({
          id: clipId,
          sceneId,
          title: clip.title,
          oneLineSummary: undefined,
          position: clipIndex + 1,
          createdAt: input.now,
          updatedAt: input.now,
        });
        addMarkdownAsset(input.markdownAssets, input.ids, input.now, {
          content: clip.summary,
          title: `${clip.title} summary`,
          role: 'summary',
          localeId: input.baseLocaleId,
          pathTarget: { kind: 'clip', sequenceSlug, sceneSlug, clipSlug },
          fileName: 'clip-summary.md',
          relationship: { kind: 'clip', clipId },
        });
        addMarkdownAsset(input.markdownAssets, input.ids, input.now, {
          content: clip.visualIntent,
          title: `${clip.title} visual intent`,
          role: 'visual_intent',
          localeId: input.baseLocaleId,
          pathTarget: { kind: 'clip', sequenceSlug, sceneSlug, clipSlug },
          fileName: 'visual-intent.md',
          relationship: { kind: 'clip', clipId },
        });
      });
    });
  });
}

function expandLanguages(setup: ProjectSetup): ProjectSetupLanguage[] {
  return [...(setup.languages ?? [])];
}

function projectSetupFromNarrativeStarter(starter: NarrativeStarter): ProjectSetup {
  return {
    kind: 'renku.projectSetup',
    version: '0.1.0',
    project: {
      name: starter.project.name,
      title: starter.project.title,
      type: starter.project.type,
      aspectRatio: starter.project.aspectRatio,
      logline: starter.project.logline,
      summary: starter.project.summary,
    },
    languages: starter.languages,
    visualLanguageCategories: starter.visualLanguageCategories,
    visualLanguage: starter.visualLanguage,
    cast: starter.cast,
    continuityReferences: starter.continuityReferences,
    sequences: starter.sequences.map((sequence) => ({
      title: sequence.title,
      shortTitle: sequence.shortTitle,
      summary: sequence.summary,
      scenes: (sequence.scenes ?? []).map((scene) => ({
        title: scene.title,
        summary: scene.summary,
        clips: (scene.clips ?? []).map((clip) => ({
          title: clip.title,
          summary: clip.summary,
          visualIntent: clip.visualIntent,
        })),
      })),
    })),
  };
}

function buildVisualLanguageCategoryRecords(input: {
  setup: ProjectSetup;
  ids: (prefix: EntityIdPrefix) => string;
  now: string;
}): Parameters<typeof insertVisualLanguageCategoryRecords>[1] {
  const categories = new Map<string, { name: string; description?: string }>();
  for (const category of input.setup.visualLanguageCategories ?? []) {
    if (!categories.has(category.name)) {
      categories.set(category.name, category);
    }
  }
  for (const entry of input.setup.visualLanguage ?? []) {
    if (!categories.has(entry.category)) {
      categories.set(entry.category, { name: entry.category });
    }
  }
  return [...categories.values()].map((category, index) => ({
    id: input.ids('visual_language_category'),
    name: category.name,
    description: category.description,
    source: 'project',
    position: index + 1,
    createdAt: input.now,
    updatedAt: input.now,
  }));
}

function buildSetupWorkspaceFolders(input: {
  setup: ProjectSetup;
  castMemberRecords: { name: string; position: number }[];
}): ProjectRelativePath[] {
  const folders = [joinProjectRelativePath(WORKING_ASSETS_BASE_ROOT, 'cast')];
  for (const castMember of input.castMemberRecords) {
    folders.push(
      joinProjectRelativePath(
        WORKING_ASSETS_BASE_ROOT,
        'cast',
        numberedSlug(castMember.position, castMember.name)
      )
    );
  }
  if ((input.setup.visualLanguageCategories?.length ?? 0) > 0) {
    folders.push(joinProjectRelativePath(WORKING_ASSETS_BASE_ROOT, 'visual-language'));
  }
  if ((input.setup.continuityReferences?.length ?? 0) > 0) {
    folders.push(joinProjectRelativePath(WORKING_ASSETS_BASE_ROOT, 'continuity'));
  }
  return folders;
}

async function ensureProjectFolders(
  projectFolder: string,
  folders: ProjectRelativePath[]
): Promise<void> {
  await Promise.all(
    folders.map((folder) =>
      fs.mkdir(resolveProjectRelativePath(projectFolder, folder), {
        recursive: true,
      })
    )
  );
}

interface SetupMarkdownAsset {
  id: string;
  fileId: string;
  relationshipId: string;
  title: string;
  content: string;
  projectRelativePath: ProjectRelativePath;
  localeId: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  relationship:
    | { kind: 'project' }
    | { kind: 'visualLanguage'; visualLanguageId: string }
    | { kind: 'continuityReference'; continuityReferenceId: string }
    | { kind: 'sequence'; sequenceId: string }
    | { kind: 'scene'; sceneId: string }
    | { kind: 'clip'; clipId: string };
}

function addMarkdownAsset(
  assets: SetupMarkdownAsset[],
  ids: (prefix: EntityIdPrefix) => string,
  now: string,
  input: {
    content?: string;
    title: string;
    role: string;
    localeId: string | null;
    pathTarget: MarkdownAssetPathTarget;
    fileName: string;
    relationship: SetupMarkdownAsset['relationship'];
  }
): void {
  if (!input.content?.trim()) {
    return;
  }

  const relationshipPrefix = relationshipIdPrefix(input.relationship.kind);
  assets.push({
    id: ids('asset'),
    fileId: ids('asset_file'),
    relationshipId: ids(relationshipPrefix),
    title: input.title,
    content: input.content,
    projectRelativePath: allocateWorkingMarkdownAssetPath({
      target: input.pathTarget,
      fileName: input.fileName,
    }),
    localeId: input.localeId,
    role: input.role,
    createdAt: now,
    updatedAt: now,
    relationship: input.relationship,
  });
}

function insertMarkdownAssetRecords(
  session: ProjectDataSession,
  asset: SetupMarkdownAsset
): void {
  insertAssetRecord(session, {
    id: asset.id,
    type: asset.role,
    mediaKind: 'text',
    title: asset.title,
    origin: 'setup',
    availability: 'ready',
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  });
  insertAssetFileRecord(session, {
    id: asset.fileId,
    assetId: asset.id,
    role: 'primary',
    projectRelativePath: asset.projectRelativePath,
    mimeType: 'text/markdown',
    mediaKind: 'text',
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  });

  if (asset.relationship.kind === 'project') {
    insertProjectAssetRecord(session, {
      id: asset.relationshipId,
      assetId: asset.id,
      localeId: asset.localeId,
      role: asset.role,
      sortOrder: 1,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }
  if (asset.relationship.kind === 'visualLanguage') {
    insertVisualLanguageAssetRecord(session, {
      id: asset.relationshipId,
      visualLanguageId: asset.relationship.visualLanguageId,
      assetId: asset.id,
      localeId: asset.localeId,
      role: asset.role,
      sortOrder: 1,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }
  if (asset.relationship.kind === 'continuityReference') {
    insertContinuityReferenceAssetRecord(session, {
      id: asset.relationshipId,
      continuityReferenceId: asset.relationship.continuityReferenceId,
      assetId: asset.id,
      localeId: asset.localeId,
      role: asset.role,
      sortOrder: 1,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }
  if (asset.relationship.kind === 'sequence') {
    insertSequenceAssetRecord(session, {
      id: asset.relationshipId,
      sequenceId: asset.relationship.sequenceId,
      assetId: asset.id,
      localeId: asset.localeId,
      role: asset.role,
      sortOrder: 1,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }
  if (asset.relationship.kind === 'scene') {
    insertSceneAssetRecord(session, {
      id: asset.relationshipId,
      sceneId: asset.relationship.sceneId,
      assetId: asset.id,
      localeId: asset.localeId,
      role: asset.role,
      sortOrder: 1,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }
  if (asset.relationship.kind === 'clip') {
    insertClipAssetRecord(session, {
      id: asset.relationshipId,
      clipId: asset.relationship.clipId,
      assetId: asset.id,
      localeId: asset.localeId,
      role: asset.role,
      sortOrder: 1,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }
}

async function updateExistingProjectSummaryAsset(input: {
  session: ProjectDataSession;
  projectFolder: string;
  content: string;
  ids: (prefix: EntityIdPrefix) => string;
  now: string;
}): Promise<void> {
  const projectSummaryAsset = listProjectAssetRecords(input.session).find(
    (asset) => asset.role === 'summary'
  );
  if (!projectSummaryAsset) {
    if (input.content.length === 0) {
      return;
    }
    const baseLocaleId =
      listProjectLocaleRecords(input.session).find((locale) => locale.isBase)?.id ??
      null;
    const asset = buildProjectSummaryAsset({
      ids: input.ids,
      now: input.now,
      content: input.content,
      localeId: baseLocaleId,
    });
    insertMarkdownAssetRecords(input.session, asset);
    await writeMarkdownAssetFile({
      projectFolder: input.projectFolder,
      projectRelativePath: asset.projectRelativePath,
      content: asset.content,
    });
    return;
  }

  const projectSummaryFile = listAssetFileRecords(input.session).find(
    (file) => file.assetId === projectSummaryAsset.assetId && file.role === 'primary'
  );
  if (!projectSummaryFile) {
    throw new ProjectDataError(
      'PROJECT_DATA062',
      `Project summary asset ${projectSummaryAsset.assetId} is missing its primary file.`
    );
  }

  await writeMarkdownAssetFile({
    projectFolder: input.projectFolder,
    projectRelativePath: normalizeProjectRelativePath(
      projectSummaryFile.projectRelativePath
    ),
    content: input.content,
  });
}

function buildProjectSummaryAsset(input: {
  ids: (prefix: EntityIdPrefix) => string;
  now: string;
  content: string;
  localeId: string | null;
}): SetupMarkdownAsset {
  const assets: SetupMarkdownAsset[] = [];
  addMarkdownAsset(assets, input.ids, input.now, {
    content: input.content,
    title: 'Project summary',
    role: 'summary',
    localeId: input.localeId,
    pathTarget: { kind: 'project' },
    fileName: 'project-summary.md',
    relationship: { kind: 'project' },
  });
  const [asset] = assets;
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA063',
      'Project summary asset could not be created from non-empty content.'
    );
  }
  return asset;
}

function readMarkdownAssetFileRecord(
  session: ProjectDataSession,
  input: { assetId: string; assetFileId: string }
) {
  const asset = readAssetRecord(session, input.assetId);
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA069',
      `Markdown asset ${input.assetId} was not found.`
    );
  }
  if (asset.mediaKind !== 'text' && asset.mediaKind !== 'markdown') {
    throw new ProjectDataError(
      'PROJECT_DATA070',
      `Asset ${input.assetId} is not a Markdown text asset.`
    );
  }

  const file = readAssetFileRecord(session, input);
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA071',
      `Markdown asset file ${input.assetFileId} was not found for asset ${input.assetId}.`
    );
  }
  if (file.role !== 'primary') {
    throw new ProjectDataError(
      'PROJECT_DATA072',
      `Markdown asset file ${input.assetFileId} is not the primary text file.`
    );
  }
  if (file.mediaKind !== 'text' && file.mediaKind !== 'markdown') {
    throw new ProjectDataError(
      'PROJECT_DATA073',
      `Asset file ${input.assetFileId} is not a Markdown text file.`
    );
  }

  return file;
}

function relationshipIdPrefix(
  kind: SetupMarkdownAsset['relationship']['kind']
): EntityIdPrefix {
  if (kind === 'project') {
    return 'project_asset';
  }
  if (kind === 'visualLanguage') {
    return 'visual_language_asset';
  }
  if (kind === 'continuityReference') {
    return 'continuity_reference_asset';
  }
  if (kind === 'sequence') {
    return 'sequence_asset';
  }
  if (kind === 'scene') {
    return 'scene_asset';
  }
  return 'clip_asset';
}

function numberedSlug(position: number, title: string): string {
  return `${String(position).padStart(2, '0')}-${slugify(title)}`;
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'untitled';
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

interface LocaleAssetReference {
  tableName: string;
  relationshipId: string;
  assetId: string;
  role: string;
}

function assertRemovedLocalesAreUnused(
  session: ProjectDataSession,
  removedLocales: ProjectLocaleRecord[]
): void {
  if (removedLocales.length === 0) {
    return;
  }

  const issues: DiagnosticIssue[] = [];
  for (const locale of removedLocales) {
    const references = listLocaleAssetReferences(session, locale.id);
    for (const reference of references) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA057',
          `Project locale ${locale.localeTag} cannot be removed because ${reference.tableName} ${reference.relationshipId} still uses asset ${reference.assetId} as ${reference.role}.`,
          {
            path: ['languages', locale.localeTag],
            context: 'project information update',
          },
          'Remove or reassign the locale-specific asset relationship before removing this project locale.'
        )
      );
    }
  }

  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throw new ProjectDataError(
      'PROJECT_DATA058',
      'Project locale removal failed because assets still use removed locales.',
      {
        issues: result.issues,
        suggestion:
          'Keep the locale, or reassign/remove the assets that still reference it before saving.',
      }
    );
  }
}

function listLocaleAssetReferences(
  session: ProjectDataSession,
  localeId: string
): LocaleAssetReference[] {
  return [
    ...listProjectAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'project_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listVisualLanguageAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'visual_language_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listCastAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'cast_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listContinuityReferenceAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'continuity_reference_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listSequenceAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'sequence_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listSceneAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'scene_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
    ...listClipAssetRecords(session)
      .filter((asset) => asset.localeId === localeId)
      .map((asset) => ({
        tableName: 'clip_asset',
        relationshipId: asset.id,
        assetId: asset.assetId,
        role: asset.role,
      })),
  ];
}

function applyProjectInformationPatch(
  project: Project,
  patch: ProjectInformationPatch
): ProjectInformationUpdate {
  const update: ProjectInformationUpdate = {
    title: patch.title ?? project.identity.title,
    aspectRatio:
      patch.aspectRatio === null
        ? undefined
        : patch.aspectRatio ?? project.identity.aspectRatio,
    logline:
      patch.logline === null ? undefined : patch.logline ?? project.identity.logline,
    summary:
      'summary' in patch ? patch.summary : project.identity.summary,
    languages: project.languages.map((language) => ({
      localeTag: language.localeTag,
      displayName: language.displayName,
      isBase: language.isBase,
      supportsAudio: language.supportsAudio,
      supportsSubtitles: language.supportsSubtitles,
    })),
  };

  for (const operation of patch.languages ?? []) {
    if (operation.operation === 'add') {
      update.languages.push({
        localeTag: operation.localeTag,
        displayName: operation.displayName,
        isBase: operation.isBase ?? false,
        supportsAudio: operation.supportsAudio ?? true,
        supportsSubtitles: operation.supportsSubtitles ?? true,
      });
      if (operation.isBase) {
        setBaseLanguage(update.languages, operation.localeTag);
      }
    }
    if (operation.operation === 'update') {
      const language = update.languages.find(
        (entry) => entry.localeTag === operation.localeTag
      );
      if (!language) {
        update.languages.push({
          localeTag: operation.localeTag,
          displayName: operation.displayName ?? undefined,
          isBase: operation.isBase ?? false,
          supportsAudio: operation.supportsAudio ?? true,
          supportsSubtitles: operation.supportsSubtitles ?? true,
        });
      } else {
        if ('displayName' in operation) {
          language.displayName = operation.displayName ?? undefined;
        }
        if (operation.supportsAudio !== undefined) {
          language.supportsAudio = operation.supportsAudio;
        }
        if (operation.supportsSubtitles !== undefined) {
          language.supportsSubtitles = operation.supportsSubtitles;
        }
        if (operation.isBase !== undefined) {
          language.isBase = operation.isBase;
        }
      }
      if (operation.isBase) {
        setBaseLanguage(update.languages, operation.localeTag);
      }
    }
    if (operation.operation === 'remove') {
      update.languages = update.languages.filter(
        (language) => language.localeTag !== operation.localeTag
      );
    }
    if (operation.operation === 'setBase') {
      setBaseLanguage(update.languages, operation.localeTag);
    }
  }

  return update;
}

function setBaseLanguage(
  languages: ProjectInformationLanguageUpdate[],
  localeTag: string
): void {
  for (const language of languages) {
    language.isBase = language.localeTag === localeTag;
  }
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
