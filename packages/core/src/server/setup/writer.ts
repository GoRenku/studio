import { ProjectDataError } from '../project-data-error.js';
import type { ProjectCounts } from '../../client/index.js';
import { insertCastMemberRecords } from '../database/access/cast-members.js';
import { insertContinuityReferenceRecords } from '../database/access/continuity-references.js';
import {
  insertClipRecord,
  insertEpisodeRecord,
  insertSceneRecord,
  insertSequenceRecord,
} from '../database/access/screenplay-projection.js';
import { insertProjectLocaleRecords } from '../database/access/project-locales.js';
import { insertProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { insertVisualLanguageCategoryRecords } from '../database/access/visual-language-categories.js';
import { insertVisualLanguageRecords } from '../database/access/visual-language.js';
import { writeMarkdownAssetFile } from '../files/markdown-asset-files.js';
import type { EntityIdPrefix } from '../entity-ids.js';
import type {
  ProjectSetup,
  ProjectSetupLanguage,
} from './contracts.js';
import {
  addProjectSetupMarkdownAsset,
  insertProjectSetupMarkdownAssetRecords,
  type ProjectSetupMarkdownAsset,
} from './markdown-assets.js';
import {
  createProjectSetupScreenplayRecords,
  writeSetupSequences,
} from './screenplay-records.js';
import { numberedSlug, slugify } from './slugs.js';
import {
  buildSetupWorkspaceFolders,
  ensureProjectFolders,
} from './workspace-folders.js';

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
  const screenplayRecords = createProjectSetupScreenplayRecords();

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
    writeSetupSequences({
      sequences: episode.sequences ?? [],
      episodeId,
      ids,
      counts,
      now,
      baseLocaleId,
      markdownAssets,
      records: screenplayRecords,
    });
  });

  writeSetupSequences({
    sequences: setup.sequences ?? [],
    episodeId: null,
    ids,
    counts,
    now,
    baseLocaleId,
    markdownAssets,
    records: screenplayRecords,
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
    for (const record of screenplayRecords.sequenceRecords) {
      insertSequenceRecord(transactionSession, record);
    }
    for (const record of screenplayRecords.sceneRecords) {
      insertSceneRecord(transactionSession, record);
    }
    for (const record of screenplayRecords.clipRecords) {
      insertClipRecord(transactionSession, record);
    }
    for (const asset of markdownAssets) {
      insertProjectSetupMarkdownAssetRecords(transactionSession, asset);
    }
    return counts;
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
