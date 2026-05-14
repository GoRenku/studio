import { readFileSync } from 'node:fs';
import { ProjectDataError } from '../project-data-error.js';
import type {
  CastMember,
  Clip,
  ContinuityReference,
  Project,
  ProjectCounts,
  ProjectInfo,
  ProjectLanguage,
  RichTextAssetLink,
  Scene,
  Sequence,
  VisualLanguage,
  VisualLanguageCategory,
} from '../../client/index.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import { listAssetFileRecords, type AssetFileRecord } from '../database/access/asset-files.js';
import {
  listCastMemberRecords,
  type CastMemberRecord,
} from '../database/access/cast-members.js';
import {
  listContinuityReferenceAssetRecords,
  type ContinuityReferenceAssetRecord,
} from '../database/access/asset-relationships/continuity-references.js';
import {
  listContinuityReferenceRecords,
  type ContinuityReferenceRecord,
} from '../database/access/continuity-references.js';
import {
  listClipRecords,
  listEpisodeRecords,
  listSceneRecords,
  listSequenceRecords,
  type ClipRecord,
  type SceneRecord,
  type SequenceRecord,
} from '../database/access/narrative.js';
import {
  listClipAssetRecords,
  listSceneAssetRecords,
  listSequenceAssetRecords,
  type ClipAssetRecord,
  type SceneAssetRecord,
  type SequenceAssetRecord,
} from '../database/access/asset-relationships/narrative.js';
import {
  listProjectLocaleRecords,
  type ProjectLocaleRecord,
} from '../database/access/project-locales.js';
import {
  listProjectAssetRecords,
  type ProjectAssetRecord,
} from '../database/access/asset-relationships/project.js';
import { readProjectRecord, type ProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  listVisualLanguageAssetRecords,
  type VisualLanguageAssetRecord,
} from '../database/access/asset-relationships/visual-language.js';
import {
  listVisualLanguageCategoryRecords,
  type VisualLanguageCategoryRecord,
} from '../database/access/visual-language-categories.js';
import {
  listVisualLanguageRecords,
  type VisualLanguageRecord,
} from '../database/access/visual-language.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { resolveProjectFolder } from '../files/project-paths.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import {
  buildRichTextAssetLink,
  type RichTextAssetRelationshipRecord,
} from '../database/access/rich-text-asset-links.js';

export async function readProject(input: ReadProjectInput): Promise<Project> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({
    projectFolder,
    create: false,
    lifetime: 'project',
  });
  try {
    return readProjectFromSession({ session, projectFolder });
  } finally {
    session.close();
  }
}

export function readProjectFromSession(input: {
  session: DatabaseSession;
  projectFolder: string;
}): Project {
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${input.session.databasePath}.`
    );
  }

  const languages = listProjectLocaleRecords(input.session).map(toProjectLanguage);
  const richText = buildRichTextAssets(input);
  const visualLanguageCategories = listVisualLanguageCategoryRecords(input.session).map(
    toVisualLanguageCategory
  );
  const visualLanguage = listVisualLanguageRecords(input.session).map((row) =>
    toVisualLanguage(row, richText)
  );
  const cast = listCastMemberRecords(input.session).map(toCastMember);
  const continuityReferences = listContinuityReferenceRecords(input.session).map(
    (row) => toContinuityReference(row, richText)
  );
  const episodeRecords = listEpisodeRecords(input.session);
  const sequenceRecords = listSequenceRecords(input.session);
  const sceneRecords = listSceneRecords(input.session);
  const clipRecords = listClipRecords(input.session);

  const topLevelSequences = buildSequences(
    sequenceRecords.filter((sequence) => sequence.episodeId === null),
    sceneRecords,
    clipRecords,
    richText
  );
  const episodes = episodeRecords.map((episode) => ({
    id: episode.id,
    title: episode.title,
    shortTitle: nullable(episode.shortTitle),
    summary: nullable(episode.oneLineSummary),
    sequences: buildSequences(
      sequenceRecords.filter((sequence) => sequence.episodeId === episode.id),
      sceneRecords,
      clipRecords,
      richText
    ),
  }));

  const counts: ProjectCounts = {
    languages: languages.length,
    visualLanguageCategories: visualLanguageCategories.length,
    visualLanguage: visualLanguage.length,
    castMembers: cast.length,
    continuityReferences: continuityReferences.length,
    episodes: episodes.length,
    sequences: sequenceRecords.length,
    scenes: sceneRecords.length,
    clips: clipRecords.length,
  };

  return {
    identity: toProjectInfo(
      project,
      input.projectFolder,
      input.session.databasePath,
      richText
    ),
    coverImage: project.coverFile === 'cover.png' ? { fileName: 'cover.png' } : null,
    languages,
    visualLanguageCategories,
    visualLanguage,
    cast,
    continuityReferences,
    episodes,
    sequences: topLevelSequences,
    counts,
  };
}

function buildSequences(
  sequenceRecords: SequenceRecord[],
  sceneRecords: SceneRecord[],
  clipRecords: ClipRecord[],
  richText: RichTextAssetIndex
): Sequence[] {
  const sequenceSummaryAssets = richText.sequence.get('summary') ?? new Map();
  return sequenceRecords.map((sequence, sequenceIndex) => ({
    id: sequence.id,
    number: sequenceIndex + 1,
    title: sequence.title,
    shortTitle: nullable(sequence.shortTitle),
    summary: nonEmpty(sequenceSummaryAssets.get(sequence.id)?.content),
    summaryAsset: sequenceSummaryAssets.get(sequence.id)?.link,
    scenes: sceneRecords
      .filter((scene) => scene.sequenceId === sequence.id)
      .map((scene) => toScene(scene, clipRecords, richText)),
  }));
}

function toProjectInfo(
  row: ProjectRecord,
  folderPath: string,
  databasePath: string,
  richText: RichTextAssetIndex
): ProjectInfo {
  const summaryAsset = richText.project.get('summary');
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    type: row.type === 'series' ? 'series' : 'standaloneMovie',
    folderPath,
    databasePath,
    aspectRatio: nullable(row.aspectRatio),
    logline: nullable(row.logline),
    summary: nonEmpty(summaryAsset?.content),
    summaryAsset: summaryAsset?.link,
  };
}

function toProjectLanguage(row: ProjectLocaleRecord): ProjectLanguage {
  return {
    id: row.id,
    localeTag: row.localeTag,
    displayName: nullable(row.displayName),
    isBase: row.isBase,
    supportsAudio: row.supportsAudio,
    supportsSubtitles: row.supportsSubtitles,
  };
}

function toVisualLanguageCategory(
  row: VisualLanguageCategoryRecord
): VisualLanguageCategory {
  return {
    id: row.id,
    name: row.name,
    description: nullable(row.description),
    source: row.source === 'system' ? 'system' : 'project',
  };
}

function toVisualLanguage(
  row: VisualLanguageRecord,
  richText: RichTextAssetIndex
): VisualLanguage {
  const guidanceAsset = richText.visualLanguage.get('guidance')?.get(row.id);
  const promptAsset = richText.visualLanguage.get('prompt')?.get(row.id);
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    summary: nullable(row.oneLineSummary),
    priority:
      row.priority === 'situational' || row.priority === 'rare'
        ? row.priority
        : 'default',
    guidance: nonEmpty(guidanceAsset?.content),
    prompt: nonEmpty(promptAsset?.content),
    guidanceAsset: guidanceAsset?.link,
    promptAsset: promptAsset?.link,
  };
}

function toCastMember(row: CastMemberRecord): CastMember {
  return {
    id: row.id,
    name: row.name,
    kind: nullable(row.kind),
    role: nullable(row.role),
    shortDescription: nullable(row.shortDescription),
  };
}

function toContinuityReference(
  row: ContinuityReferenceRecord,
  richText: RichTextAssetIndex
): ContinuityReference {
  const descriptionAsset = richText.continuityReference
    .get('description')
    ?.get(row.id);
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    summary: nullable(row.oneLineSummary),
    description: nonEmpty(descriptionAsset?.content),
    descriptionAsset: descriptionAsset?.link,
  };
}

function toScene(
  row: SceneRecord,
  clipRecords: ClipRecord[],
  richText: RichTextAssetIndex
): Scene {
  const summaryAsset = richText.scene.get('summary')?.get(row.id);
  return {
    id: row.id,
    title: row.title,
    summary: nonEmpty(summaryAsset?.content),
    summaryAsset: summaryAsset?.link,
    clips: clipRecords
      .filter((clip) => clip.sceneId === row.id)
      .map((clip) => toClip(clip, richText)),
  };
}

function toClip(row: ClipRecord, richText: RichTextAssetIndex): Clip {
  const summaryAsset = richText.clip.get('summary')?.get(row.id);
  const visualIntentAsset = richText.clip.get('visual_intent')?.get(row.id);
  return {
    id: row.id,
    title: row.title,
    summary: nonEmpty(summaryAsset?.content),
    visualIntent: nonEmpty(visualIntentAsset?.content),
    summaryAsset: summaryAsset?.link,
    visualIntentAsset: visualIntentAsset?.link,
  };
}

function nullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

interface RichTextAsset {
  content: string;
  link: RichTextAssetLink;
}

interface RichTextAssetIndex {
  project: Map<string, RichTextAsset>;
  visualLanguage: Map<string, Map<string, RichTextAsset>>;
  continuityReference: Map<string, Map<string, RichTextAsset>>;
  sequence: Map<string, Map<string, RichTextAsset>>;
  scene: Map<string, Map<string, RichTextAsset>>;
  clip: Map<string, Map<string, RichTextAsset>>;
}

const projectRichTextRoles = new Set(['summary']);
const visualLanguageRichTextRoles = new Set(['guidance', 'prompt']);
const continuityReferenceRichTextRoles = new Set(['description']);
const sequenceRichTextRoles = new Set(['summary']);
const sceneRichTextRoles = new Set(['summary']);
const clipRichTextRoles = new Set(['summary', 'visual_intent']);

function buildRichTextAssets(input: {
  session: DatabaseSession;
  projectFolder: string;
}): RichTextAssetIndex {
  const assetFilesByAssetId = new Map<string, AssetFileRecord>();
  for (const file of listAssetFileRecords(input.session)) {
    if (file.role === 'primary') {
      assetFilesByAssetId.set(file.assetId, file);
    }
  }

  const index: RichTextAssetIndex = {
    project: new Map(),
    visualLanguage: new Map(),
    continuityReference: new Map(),
    sequence: new Map(),
    scene: new Map(),
    clip: new Map(),
  };

  for (const row of listProjectAssetRecords(input.session)) {
    const asset = toRichTextAsset(input, row, assetFilesByAssetId, {
      relationshipLabel: 'project',
      richTextRoles: projectRichTextRoles,
    });
    if (asset) {
      index.project.set(row.role, asset);
    }
  }

  for (const row of listVisualLanguageAssetRecords(input.session)) {
    const asset = toRichTextAsset(input, row, assetFilesByAssetId, {
      relationshipLabel: 'visual language',
      richTextRoles: visualLanguageRichTextRoles,
    });
    if (asset) {
      setScopedRichTextAsset(index.visualLanguage, row.role, row.visualLanguageId, asset);
    }
  }

  for (const row of listContinuityReferenceAssetRecords(input.session)) {
    const asset = toRichTextAsset(input, row, assetFilesByAssetId, {
      relationshipLabel: 'continuity reference',
      richTextRoles: continuityReferenceRichTextRoles,
    });
    if (asset) {
      setScopedRichTextAsset(
        index.continuityReference,
        row.role,
        row.continuityReferenceId,
        asset
      );
    }
  }

  for (const row of listSequenceAssetRecords(input.session)) {
    const asset = toRichTextAsset(input, row, assetFilesByAssetId, {
      relationshipLabel: 'sequence',
      richTextRoles: sequenceRichTextRoles,
    });
    if (asset) {
      setScopedRichTextAsset(index.sequence, row.role, row.sequenceId, asset);
    }
  }

  for (const row of listSceneAssetRecords(input.session)) {
    const asset = toRichTextAsset(input, row, assetFilesByAssetId, {
      relationshipLabel: 'scene',
      richTextRoles: sceneRichTextRoles,
    });
    if (asset) {
      setScopedRichTextAsset(index.scene, row.role, row.sceneId, asset);
    }
  }

  for (const row of listClipAssetRecords(input.session)) {
    const asset = toRichTextAsset(input, row, assetFilesByAssetId, {
      relationshipLabel: 'clip',
      richTextRoles: clipRichTextRoles,
    });
    if (asset) {
      setScopedRichTextAsset(index.clip, row.role, row.clipId, asset);
    }
  }

  return index;
}

function toRichTextAsset(
  input: { projectFolder: string },
  row:
    | ProjectAssetRecord
    | VisualLanguageAssetRecord
    | ContinuityReferenceAssetRecord
    | SequenceAssetRecord
    | SceneAssetRecord
    | ClipAssetRecord,
  assetFilesByAssetId: Map<string, AssetFileRecord>,
  context: {
    relationshipLabel: string;
    richTextRoles: ReadonlySet<string>;
  }
): RichTextAsset | null {
  const file = assetFilesByAssetId.get(row.assetId);
  const link = buildRichTextAssetLink({
    relationship: toRichTextRelationship(row),
    file,
    relationshipLabel: context.relationshipLabel,
    richTextRoles: context.richTextRoles,
  });
  if (!link) {
    return null;
  }

  const absolutePath = resolveProjectRelativePath(
    input.projectFolder,
    normalizeProjectRelativePath(link.projectRelativePath)
  );
  const content = readFileSync(absolutePath, 'utf8').trimEnd();

  return {
    content,
    link,
  };
}

function toRichTextRelationship(
  row:
    | ProjectAssetRecord
    | VisualLanguageAssetRecord
    | ContinuityReferenceAssetRecord
    | SequenceAssetRecord
    | SceneAssetRecord
    | ClipAssetRecord
): RichTextAssetRelationshipRecord {
  return {
    relationshipId: row.id,
    assetId: row.assetId,
    role: row.role,
    localeId: row.localeId,
  };
}

function setScopedRichTextAsset(
  map: Map<string, Map<string, RichTextAsset>>,
  role: string,
  targetId: string,
  asset: RichTextAsset
): void {
  const roleMap = map.get(role) ?? new Map<string, RichTextAsset>();
  roleMap.set(targetId, asset);
  map.set(role, roleMap);
}
