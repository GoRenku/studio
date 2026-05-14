import fs from 'node:fs/promises';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectCounts } from '../../client/index.js';
import { insertCastMemberRecords } from '../database/access/cast-members.js';
import { insertContinuityReferenceRecords } from '../database/access/continuity-references.js';
import {
  insertClipRecord,
  insertEpisodeRecord,
  insertSceneRecord,
  insertSequenceRecord,
} from '../database/access/narrative.js';
import { insertProjectLocaleRecords } from '../database/access/project-locales.js';
import { insertProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { insertVisualLanguageCategoryRecords } from '../database/access/visual-language-categories.js';
import { insertVisualLanguageRecords } from '../database/access/visual-language.js';
import { writeMarkdownAssetFile } from '../files/markdown-asset-files.js';
import { WORKING_ASSETS_BASE_ROOT } from '../files/asset-paths.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import type { ProjectRelativePath } from '../../client/index.js';
import type { EntityIdPrefix } from '../entity-ids.js';
import type {
  ProjectSetup,
  ProjectSetupLanguage,
  ProjectSetupSequence,
} from './contracts.js';
import {
  addProjectSetupMarkdownAsset,
  insertProjectSetupMarkdownAssetRecords,
  type ProjectSetupMarkdownAsset,
} from './markdown-assets.js';

export async function writeProjectSetupRecords(
  session: DatabaseSession,
  setup: ProjectSetup,
  ids: (prefix: EntityIdPrefix) => string,
  now: string,
  coverFile: string | null,
  projectFolder: string
): Promise<ProjectCounts> {
  const markdownAssets: ProjectSetupMarkdownAsset[] = [];
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
  addProjectSetupMarkdownAsset(markdownAssets, ids, now, {
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
    addProjectSetupMarkdownAsset(markdownAssets, ids, now, {
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
    addProjectSetupMarkdownAsset(markdownAssets, ids, now, {
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

  const castMemberRecords = (setup.cast ?? []).map((castMember, index) => {
    const castMemberId = ids('cast');
    addProjectSetupMarkdownAsset(markdownAssets, ids, now, {
      content: castMember.description,
      title: `${castMember.name} description`,
      role: 'description',
      localeId: baseLocaleId,
      pathTarget: {
        kind: 'castMember',
        slug: numberedSlug(index + 1, castMember.name),
      },
      fileName: 'description.md',
      relationship: {
        kind: 'castMember',
        castMemberId,
      },
    });
    return {
      id: castMemberId,
      name: castMember.name,
      kind: castMember.kind,
      role: castMember.role,
      shortDescription: castMember.shortDescription,
      position: index + 1,
      createdAt: now,
      updatedAt: now,
    };
  });
  const workspaceFolders = buildSetupWorkspaceFolders({
    setup,
    castMemberRecords,
  });

  const continuityReferenceRecords = (setup.continuityReferences ?? []).map(
    (entry, index) => {
      const continuityReferenceId = ids('continuity_reference');
      addProjectSetupMarkdownAsset(markdownAssets, ids, now, {
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

  return session.db.transaction((tx) => {
    const transactionSession = { ...session, db: tx };
    insertProjectRecord(transactionSession, {
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

    insertProjectLocaleRecords(transactionSession, localeRecords);
    insertVisualLanguageCategoryRecords(transactionSession, visualLanguageCategoryRecords);
    insertVisualLanguageRecords(transactionSession, visualLanguageRecords);
    insertCastMemberRecords(transactionSession, castMemberRecords);
    insertContinuityReferenceRecords(transactionSession, continuityReferenceRecords);
    for (const record of episodeRecords) {
      insertEpisodeRecord(transactionSession, record);
    }
    for (const record of sequenceRecords) {
      insertSequenceRecord(transactionSession, record);
    }
    for (const record of sceneRecords) {
      insertSceneRecord(transactionSession, record);
    }
    for (const record of clipRecords) {
      insertClipRecord(transactionSession, record);
    }
    for (const asset of markdownAssets) {
      insertProjectSetupMarkdownAssetRecords(transactionSession, asset);
    }
    return counts;
  });
}

function writeSequences(input: {
  input: ProjectSetupSequence[];
  episodeId: string | null;
  ids: (prefix: EntityIdPrefix) => string;
  counts: ProjectCounts;
  now: string;
  baseLocaleId: string | null;
  markdownAssets: ProjectSetupMarkdownAsset[];
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
    addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
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
      addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
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
        addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
          content: clip.summary,
          title: `${clip.title} summary`,
          role: 'summary',
          localeId: input.baseLocaleId,
          pathTarget: { kind: 'clip', sequenceSlug, sceneSlug, clipSlug },
          fileName: 'clip-summary.md',
          relationship: { kind: 'clip', clipId },
        });
        addProjectSetupMarkdownAsset(input.markdownAssets, input.ids, input.now, {
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
