import type {
  CastMember,
  Clip,
  Scene,
  Sequence,
} from '@gorenku/studio-core';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';

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
  sequences: Map<string, Sequence>;
  scenes: Map<string, Scene>;
  clips: Map<string, Clip>;
  cast: Map<string, CastMember>;
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
  project: ProjectWithHttp
): MovieStudioLookup {
  const sequences = new Map<string, Sequence>();
  const scenes = new Map<string, Scene>();
  const clips = new Map<string, Clip>();
  const cast = new Map(project.cast.map((entry) => [entry.id, entry]));

  for (const sequence of project.sequences) {
    sequences.set(sequence.id, sequence);
    for (const scene of sequence.scenes) {
      scenes.set(scene.id, scene);
      for (const clip of scene.clips) {
        clips.set(clip.id, clip);
      }
    }
  }

  return { sequences, scenes, clips, cast };
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
        summary: sequence.summary ?? 'Sequence structure loaded from project data.',
        clips: sequence.scenes.flatMap((scene) => scene.clips),
      };
    }
  }

  if (selection.type === 'scene') {
    const scene = lookup.scenes.get(selection.id);
    if (scene) {
      return {
        valid: true,
        kicker: scene.title,
        summary: scene.summary ?? 'Scene structure loaded from project data.',
        clips: scene.clips,
      };
    }
  }

  if (selection.type === 'clip') {
    const clip = lookup.clips.get(selection.id);
    if (clip) {
      return {
        valid: true,
        kicker: clip.title,
        summary: clip.summary ?? 'Clip structure loaded from project data.',
        clips: [clip],
        clip,
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
        : 'Movie hierarchy loaded from project data. Production readiness starts at narrative only.',
    clips: Array.from(lookup.clips.values()),
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
