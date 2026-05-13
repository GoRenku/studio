import type {
  CastMember,
  Clip,
  ClipNavigationRow,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '@gorenku/studio-core';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type { StoryNavigationState } from './use-story-navigation';

export type MovieStudioSelection =
  | { type: 'projectInformation' }
  | { type: 'visualLanguage' }
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'clip'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };

export interface MovieStudioLookup {
  sequences: Map<string, SequenceNavigationRow>;
  scenes: Map<string, SceneNavigationRow>;
  clips: Map<string, ClipNavigationRow>;
  cast: Map<string, CastMember>;
  clipsBySequenceId: Map<string, ClipNavigationRow[]>;
  clipsBySceneId: Map<string, ClipNavigationRow[]>;
}

export interface ResolvedMovieStudioSelection {
  valid: boolean;
  kicker: string;
  summary: string;
  clips: Clip[];
  clip?: Clip;
  castEntry?: CastMember;
}

export function buildMovieStudioLookup(
  project: ProjectShellWithHttp,
  storyNavigation: StoryNavigationState
): MovieStudioLookup {
  const sequences = new Map<string, SequenceNavigationRow>();
  const scenes = new Map<string, SceneNavigationRow>();
  const clips = new Map<string, ClipNavigationRow>();
  const clipsBySequenceId = new Map<string, ClipNavigationRow[]>();
  const clipsBySceneId = new Map<string, ClipNavigationRow[]>();
  const cast = new Map(project.cast.map((entry) => [entry.id, entry]));

  for (const sequence of allSequenceRows(storyNavigation)) {
    sequences.set(sequence.id, sequence);
    const sequenceClips: ClipNavigationRow[] = [];
    for (const scene of storyNavigation.scenesBySequenceId.get(sequence.id) ?? []) {
      scenes.set(scene.id, scene);
      const sceneClips = storyNavigation.clipsBySceneId.get(scene.id) ?? [];
      clipsBySceneId.set(scene.id, sceneClips);
      for (const clip of sceneClips) {
        clips.set(clip.id, clip);
        sequenceClips.push(clip);
      }
    }
    clipsBySequenceId.set(sequence.id, sequenceClips);
  }

  return { sequences, scenes, clips, cast, clipsBySequenceId, clipsBySceneId };
}

export function resolveMovieStudioSelection(
  selection: MovieStudioSelection,
  lookup: MovieStudioLookup
): ResolvedMovieStudioSelection {
  if (selection.type === 'sequence') {
    const sequence = lookup.sequences.get(selection.id);
    if (sequence) {
      return {
        valid: true,
        kicker: sequence.title,
        summary: `${sequence.sceneCount} scenes, ${sequence.clipCount} clips.`,
        clips: toClips(lookup.clipsBySequenceId.get(sequence.id) ?? []),
      };
    }
  }

  if (selection.type === 'scene') {
    const scene = lookup.scenes.get(selection.id);
    if (scene) {
      return {
        valid: true,
        kicker: scene.title,
        summary: `${scene.clipCount} clips.`,
        clips: toClips(lookup.clipsBySceneId.get(scene.id) ?? []),
      };
    }
  }

  if (selection.type === 'clip') {
    const clip = lookup.clips.get(selection.id);
    if (clip) {
      return {
        valid: true,
        kicker: clip.title,
        summary: clip.oneLineSummary ?? 'Clip structure loaded from project data.',
        clips: [toClip(clip)],
        clip: toClip(clip),
      };
    }
  }

  if (selection.type === 'cast') {
    const castEntry = lookup.cast.get(selection.id);
    if (castEntry) {
      return {
        valid: true,
        kicker: castEntry.name,
        summary: castEntry.shortDescription ?? 'Cast structure loaded from project data.',
        clips: [],
        castEntry,
      };
    }
  }

  if (selection.type === 'projectInformation') {
    return {
      valid: true,
      kicker: 'Project Information',
      summary: 'Project information loaded from project data.',
      clips: [],
    };
  }

  if (selection.type === 'visualLanguage') {
    return {
      valid: true,
      kicker: 'Visual Language',
      summary: 'Visual language loaded from project data.',
      clips: [],
    };
  }

  return {
    valid: selection.type === 'casting' || selection.type === 'storyboard',
    kicker: selection.type === 'casting' ? 'Cast' : 'Full Storyboard',
    summary:
      selection.type === 'casting'
        ? 'Cast entries loaded from project data.'
        : 'Story navigation loads sequence, scene, and clip pages as you open them.',
    clips: toClips(Array.from(lookup.clips.values())),
  };
}

function allSequenceRows(
  storyNavigation: StoryNavigationState
): SequenceNavigationRow[] {
  return [
    ...storyNavigation.standaloneSequences,
    ...Array.from(storyNavigation.sequencesByEpisodeId.values()).flat(),
  ];
}

function toClips(rows: ClipNavigationRow[]): Clip[] {
  return rows.map(toClip);
}

function toClip(row: ClipNavigationRow): Clip {
  return {
    id: row.id,
    title: row.title,
    summary: row.oneLineSummary,
  };
}

export function toggleSetValue(current: Set<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}
