import { eq } from 'drizzle-orm';
import {
  castMembers,
  clips,
  episodes,
  scenes,
  sequences,
} from '../schema/index.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import type {
  ClipNavigationRow,
  EpisodeNavigationRow,
  StudioSelection,
  StudioSelectionContextResult,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  listCastNavigationPage,
  listSceneNavigationPage,
  listStandaloneMovieSequenceNavigationPage,
} from './navigation.js';

export function readStudioSelectionContextProjection(
  session: DatabaseSession,
  input: { selection: StudioSelection }
): StudioSelectionContextResult {
  try {
    switch (input.selection.type) {
      case 'projectInformation':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'project-information' },
          resourceKeys: ['project-information'],
        };
      case 'visualLanguage':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'visual-language' },
          resourceKeys: ['navigation:visual-language'],
        };
      case 'storyboard':
        return {
          valid: true,
          selection: input.selection,
          context: { surface: 'storyboard' },
          resourceKeys: ['project-shell'],
        };
      case 'casting':
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'casting',
            cast: listCastNavigationPage(session, {}),
          },
          resourceKeys: ['navigation:cast'],
        };
      case 'cast': {
        const castMember = session.db
          .select()
          .from(castMembers)
          .where(eq(castMembers.id, input.selection.id))
          .get();
        return castMember
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'cast-design',
                castMember: {
                  id: castMember.id,
                  name: castMember.name,
                  kind: castMember.kind ?? undefined,
                  role: castMember.role ?? undefined,
                },
              },
              resourceKeys: [`surface:cast-design:${castMember.id}`],
            }
          : selectionNotFound(input.selection);
      }
      case 'sequence': {
        const chain = readSequenceNavigationContext(session, input.selection.id);
        return chain
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'sequence',
                sequence: chain.sequence,
                episode: chain.episode,
              },
              resourceKeys: [
                chain.episode
                  ? `navigation:episode-sequences:${chain.episode.id}`
                  : 'navigation:movie-sequences',
              ],
            }
          : selectionNotFound(input.selection);
      }
      case 'scene': {
        const chain = readSceneNavigationContext(session, input.selection.id);
        return chain
          ? {
              valid: true,
              selection: input.selection,
              context: {
                surface: 'scene',
                scene: chain.scene,
                sequence: chain.sequence,
                episode: chain.episode,
              },
              resourceKeys: [`navigation:sequence-scenes:${chain.sequence.id}`],
            }
          : selectionNotFound(input.selection);
      }
      case 'clip': {
        const chain = readClipParentChain(session, input.selection.id);
        return {
          valid: true,
          selection: input.selection,
          context: {
            surface: 'clip-design',
            clip: chain.clip,
            scene: chain.scene,
            sequence: chain.sequence,
            episode: chain.episode,
          },
          resourceKeys: [`surface:clip-design:${chain.clip.id}`],
        };
      }
    }
  } catch (error) {
    if (error instanceof ProjectDataError && error.code === 'PROJECT_DATA116') {
      return selectionNotFound(input.selection);
    }
    throw error;
  }
}

export function readClipParentChain(
  session: DatabaseSession,
  clipId: string
): {
  clip: ClipNavigationRow;
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  episode?: EpisodeNavigationRow;
} {
  const clip = session.db.select().from(clips).where(eq(clips.id, clipId)).get();
  if (!clip) {
    throw new ProjectDataError('PROJECT_DATA116', `Clip was not found: ${clipId}.`);
  }
  const sceneContext = readSceneNavigationContext(session, clip.sceneId);
  if (!sceneContext) {
    throw new ProjectDataError(
      'PROJECT_DATA116',
      `Clip parent chain was not found: ${clipId}.`
    );
  }
  return {
    clip: {
      id: clip.id,
      sceneId: clip.sceneId,
      title: clip.title,
      oneLineSummary: clip.oneLineSummary ?? undefined,
    },
    scene: sceneContext.scene,
    sequence: sceneContext.sequence,
    episode: sceneContext.episode,
  };
}

function readSceneNavigationContext(
  session: DatabaseSession,
  sceneId: string
):
  | {
      scene: SceneNavigationRow;
      sequence: SequenceNavigationRow;
      episode?: EpisodeNavigationRow;
    }
  | null {
  const scene = session.db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene) {
    return null;
  }
  const sequence = readSequenceNavigationContext(session, scene.sequenceId);
  if (!sequence) {
    return null;
  }
  return {
    scene: {
      id: scene.id,
      sequenceId: scene.sequenceId,
      title: scene.title,
      clipCount: countSceneClips(session, scene.id),
    },
    sequence: sequence.sequence,
    episode: sequence.episode,
  };
}

function readSequenceNavigationContext(
  session: DatabaseSession,
  sequenceId: string
): { sequence: SequenceNavigationRow; episode?: EpisodeNavigationRow } | null {
  const sequence = session.db
    .select()
    .from(sequences)
    .where(eq(sequences.id, sequenceId))
    .get();
  if (!sequence) {
    return null;
  }
  return {
    sequence: {
      id: sequence.id,
      episodeId: sequence.episodeId ?? undefined,
      number: sequenceNumber(session, sequence.id, sequence.episodeId),
      title: sequence.title,
      shortTitle: sequence.shortTitle ?? undefined,
      sceneCount: listSceneNavigationPage(session, { sequenceId: sequence.id }).items.length,
      clipCount: countSequenceClips(session, sequence.id),
    },
    episode: sequence.episodeId
      ? readEpisodeNavigationRow(session, sequence.episodeId) ?? undefined
      : undefined,
  };
}

function readEpisodeNavigationRow(
  session: DatabaseSession,
  episodeId: string
): EpisodeNavigationRow | null {
  const episode = session.db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .get();
  if (!episode) {
    return null;
  }
  return {
    id: episode.id,
    number: episode.episodeNumber ?? episode.position,
    title: episode.title,
    shortTitle: episode.shortTitle ?? undefined,
    sequenceCount: countEpisodeSequences(session, episode.id),
    sceneCount: countEpisodeScenes(session, episode.id),
    clipCount: countEpisodeClips(session, episode.id),
  };
}

function sequenceNumber(
  session: DatabaseSession,
  sequenceId: string,
  episodeId: string | null
): number {
  const page =
    episodeId === null
      ? listStandaloneMovieSequenceNavigationPage(session, { limit: 200 })
      : {
          items: session.db
            .select({ id: sequences.id })
            .from(sequences)
            .where(eq(sequences.episodeId, episodeId))
            .orderBy(sequences.position, sequences.id)
            .all()
            .map((row, index) => ({ id: row.id, number: index + 1 })),
        };
  const row = page.items.find((item) => item.id === sequenceId);
  return row?.number ?? 1;
}

function countSceneClips(session: DatabaseSession, sceneId: string): number {
  return session.db
    .select({ id: clips.id })
    .from(clips)
    .where(eq(clips.sceneId, sceneId))
    .all().length;
}

function countSequenceClips(session: DatabaseSession, sequenceId: string): number {
  const sceneRows = session.db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.sequenceId, sequenceId))
    .all();
  return sceneRows.reduce(
    (total, scene) => total + countSceneClips(session, scene.id),
    0
  );
}

function countEpisodeSequences(session: DatabaseSession, episodeId: string): number {
  return session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(eq(sequences.episodeId, episodeId))
    .all().length;
}

function countEpisodeScenes(session: DatabaseSession, episodeId: string): number {
  const sequenceRows = session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(eq(sequences.episodeId, episodeId))
    .all();
  return sequenceRows.reduce(
    (total, sequence) =>
      total +
      session.db
        .select({ id: scenes.id })
        .from(scenes)
        .where(eq(scenes.sequenceId, sequence.id))
        .all().length,
    0
  );
}

function countEpisodeClips(session: DatabaseSession, episodeId: string): number {
  const sequenceRows = session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(eq(sequences.episodeId, episodeId))
    .all();
  return sequenceRows.reduce(
    (total, sequence) => total + countSequenceClips(session, sequence.id),
    0
  );
}

function selectionNotFound(selection: StudioSelection): StudioSelectionContextResult {
  return {
    valid: false,
    reason: 'selectionNotFound',
    diagnostics: buildDiagnosticResult([
      createDiagnosticError(
        'PROJECT_DATA119',
        'Movie Studio selection was not found in the selected project.',
        { path: [], context: 'movie studio selection' },
        'Refresh Studio or choose an existing project item.'
      ),
    ]).issues,
  };
}
