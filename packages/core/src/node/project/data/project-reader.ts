import { ProjectDataError } from '../../../project/errors.js';
import type {
  CastMember,
  Clip,
  Project,
  ProjectCounts,
  ProjectIdentity,
  ProjectLanguage,
  Scene,
  Sequence,
  VisualLanguage,
} from '../../../project/index.js';
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
  listProjectLanguageRecords,
  type ProjectLanguageRecord,
} from './project-language-records.js';
import { readProjectRecord, type ProjectRecord } from './project-records.js';
import type { ProjectDataSession } from './sqlite-project-store.js';
import {
  listVisualLanguageRecords,
  type VisualLanguageRecord,
} from './visual-language-records.js';

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

  const languages = listProjectLanguageRecords(input.session).map(toProjectLanguage);
  const visualLanguage = listVisualLanguageRecords(input.session).map(toVisualLanguage);
  const cast = listCastMemberRecords(input.session).map(toCastMember);
  const episodeRecords = listEpisodeRecords(input.session);
  const sequenceRecords = listSequenceRecords(input.session);
  const sceneRecords = listSceneRecords(input.session);
  const clipRecords = listClipRecords(input.session);

  const topLevelSequences = buildSequences(
    sequenceRecords.filter((sequence) => sequence.episodeId === null),
    sceneRecords,
    clipRecords
  );
  const episodes = episodeRecords.map((episode) => ({
    id: episode.id,
    title: episode.title,
    shortTitle: nullable(episode.shortTitle),
    summary: nullable(episode.summary),
    sequences: buildSequences(
      sequenceRecords.filter((sequence) => sequence.episodeId === episode.id),
      sceneRecords,
      clipRecords
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
    identity: toProjectIdentity(project, input.projectFolder, input.session.databasePath),
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
  clipRecords: ClipRecord[]
): Sequence[] {
  return sequenceRecords.map((sequence, sequenceIndex) => ({
    id: sequence.id,
    number: sequenceIndex + 1,
    title: sequence.title,
    shortTitle: nullable(sequence.shortTitle),
    summary: nullable(sequence.summary),
    scenes: sceneRecords
      .filter((scene) => scene.sequenceId === sequence.id)
      .map((scene) => toScene(scene, clipRecords)),
  }));
}

function toProjectIdentity(
  row: ProjectRecord,
  folderPath: string,
  databasePath: string
): ProjectIdentity {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    type: row.type === 'series' ? 'series' : 'standaloneMovie',
    folderPath,
    databasePath,
    aspectRatio: nullable(row.aspectRatio),
    logline: nullable(row.logline),
    summary: nullable(row.summary),
  };
}

function toProjectLanguage(row: ProjectLanguageRecord): ProjectLanguage {
  return {
    id: row.id,
    localeTag: row.localeTag,
    displayName: nullable(row.displayName),
    isBase: row.isBase,
    supportsAudio: row.supportsAudio,
    supportsSubtitles: row.supportsSubtitles,
  };
}

function toVisualLanguage(row: VisualLanguageRecord): VisualLanguage {
  return {
    id: row.id,
    name: row.name,
    intent: nullable(row.intent),
    summary: nullable(row.summary),
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

function toScene(row: SceneRecord, clipRecords: ClipRecord[]): Scene {
  return {
    id: row.id,
    title: row.title,
    summary: nullable(row.summary),
    clips: clipRecords
      .filter((clip) => clip.sceneId === row.id)
      .map(toClip),
  };
}

function toClip(row: ClipRecord): Clip {
  return {
    id: row.id,
    title: row.title,
    summary: nullable(row.summary),
    visualIntent: nullable(row.visualIntent),
  };
}

function nullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
