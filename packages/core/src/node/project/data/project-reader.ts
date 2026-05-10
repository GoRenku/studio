import { readFileSync } from 'node:fs';
import { ProjectDataError } from '../../../project/errors.js';
import type {
  CastMember,
  Clip,
  Project,
  ProjectCounts,
  ProjectIdentity,
  ProjectLanguage,
  RichTextAssetLink,
  Scene,
  Sequence,
  VisualLanguage,
} from '../../../project/index.js';
import { listAssetFileRecords, type AssetFileRecord } from './asset-file-records.js';
import {
  listCastMemberRecords,
  type CastMemberRecord,
} from './cast-member-records.js';
import {
  listClipRecords,
  listEpisodeRecords,
  listSceneRecords,
  listSequenceRecords,
  type ClipRecord,
  type SceneRecord,
  type SequenceRecord,
} from './narrative-records.js';
import {
  listClipAssetRecords,
  listSceneAssetRecords,
  listSequenceAssetRecords,
  type ClipAssetRecord,
  type SceneAssetRecord,
  type SequenceAssetRecord,
} from './narrative-asset-records.js';
import {
  listProjectLocaleRecords,
  type ProjectLocaleRecord,
} from './project-locale-records.js';
import {
  listProjectAssetRecords,
  type ProjectAssetRecord,
} from './project-asset-records.js';
import { readProjectRecord, type ProjectRecord } from './project-records.js';
import type { ProjectDataSession } from './sqlite-project-store.js';
import {
  listVisualLanguageAssetRecords,
  type VisualLanguageAssetRecord,
} from './visual-language-asset-records.js';
import {
  listVisualLanguageRecords,
  type VisualLanguageRecord,
} from './visual-language-records.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';

export function readProjectFromSession(input: {
  session: ProjectDataSession;
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
  const visualLanguage = listVisualLanguageRecords(input.session).map((row) =>
    toVisualLanguage(row, richText)
  );
  const cast = listCastMemberRecords(input.session).map(toCastMember);
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
    visualLanguage: visualLanguage.length,
    castMembers: cast.length,
    episodes: episodes.length,
    sequences: sequenceRecords.length,
    scenes: sceneRecords.length,
    clips: clipRecords.length,
  };

  return {
    identity: toProjectIdentity(
      project,
      input.projectFolder,
      input.session.databasePath,
      richText
    ),
    coverImage: project.coverFile === 'cover.png' ? { fileName: 'cover.png' } : null,
    languages,
    visualLanguage,
    cast,
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

function toProjectIdentity(
  row: ProjectRecord,
  folderPath: string,
  databasePath: string,
  richText: RichTextAssetIndex
): ProjectIdentity {
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

function toVisualLanguage(
  row: VisualLanguageRecord,
  richText: RichTextAssetIndex
): VisualLanguage {
  const intentAsset = richText.visualLanguage.get('intent')?.get(row.id);
  return {
    id: row.id,
    name: row.name,
    intent: nonEmpty(intentAsset?.content),
    summary: nullable(row.oneLineSummary),
    intentAsset: intentAsset?.link,
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
  sequence: Map<string, Map<string, RichTextAsset>>;
  scene: Map<string, Map<string, RichTextAsset>>;
  clip: Map<string, Map<string, RichTextAsset>>;
}

function buildRichTextAssets(input: {
  session: ProjectDataSession;
  projectFolder: string;
}): RichTextAssetIndex {
  const assetFilesByAssetId = new Map<string, AssetFileRecord>();
  for (const file of listAssetFileRecords(input.session)) {
    if (file.mediaKind === 'text' && file.role === 'primary') {
      assetFilesByAssetId.set(file.assetId, file);
    }
  }

  const index: RichTextAssetIndex = {
    project: new Map(),
    visualLanguage: new Map(),
    sequence: new Map(),
    scene: new Map(),
    clip: new Map(),
  };

  for (const row of listProjectAssetRecords(input.session)) {
    index.project.set(row.assetRole, toRichTextAsset(input, row, assetFilesByAssetId));
  }

  for (const row of listVisualLanguageAssetRecords(input.session)) {
    setScopedRichTextAsset(
      index.visualLanguage,
      row.assetRole,
      row.visualLanguageId,
      toRichTextAsset(input, row, assetFilesByAssetId)
    );
  }

  for (const row of listSequenceAssetRecords(input.session)) {
    setScopedRichTextAsset(
      index.sequence,
      row.assetRole,
      row.sequenceId,
      toRichTextAsset(input, row, assetFilesByAssetId)
    );
  }

  for (const row of listSceneAssetRecords(input.session)) {
    setScopedRichTextAsset(
      index.scene,
      row.assetRole,
      row.sceneId,
      toRichTextAsset(input, row, assetFilesByAssetId)
    );
  }

  for (const row of listClipAssetRecords(input.session)) {
    setScopedRichTextAsset(
      index.clip,
      row.assetRole,
      row.clipId,
      toRichTextAsset(input, row, assetFilesByAssetId)
    );
  }

  return index;
}

function toRichTextAsset(
  input: { projectFolder: string },
  row:
    | ProjectAssetRecord
    | VisualLanguageAssetRecord
    | SequenceAssetRecord
    | SceneAssetRecord
    | ClipAssetRecord,
  assetFilesByAssetId: Map<string, AssetFileRecord>
): RichTextAsset {
  const file = assetFilesByAssetId.get(row.assetId);
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA061',
      `Text asset ${row.assetId} is missing its primary asset file.`
    );
  }

  const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
  const absolutePath = resolveProjectRelativePath(input.projectFolder, projectRelativePath);
  const content = readFileSync(absolutePath, 'utf8').trimEnd();

  return {
    content,
    link: {
      assetId: row.assetId,
      assetFileId: file.id,
      assetRole: row.assetRole,
      localeId: nullable(row.localeId),
      projectRelativePath,
    },
  };
}

function setScopedRichTextAsset(
  map: Map<string, Map<string, RichTextAsset>>,
  assetRole: string,
  targetId: string,
  asset: RichTextAsset
): void {
  const roleMap = map.get(assetRole) ?? new Map<string, RichTextAsset>();
  roleMap.set(targetId, asset);
  map.set(assetRole, roleMap);
}
