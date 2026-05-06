import type {
  CastMember,
  Clip,
  ProjectWithHttp,
  Scene,
  Sequence,
  Selection,
} from '@/types/movie-project';

export interface MovieLookup {
  sequences: Map<string, Sequence>;
  scenes: Map<string, Scene>;
  clips: Map<string, Clip>;
  cast: Map<string, CastMember>;
}

export interface ResolvedSelection {
  kicker: string;
  title: string;
  summary: string;
  clips: Clip[];
  clip?: Clip;
  castEntry?: CastMember;
}

export function buildMovieLookup(project: ProjectWithHttp): MovieLookup {
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

export function resolveMovieSelection(
  selection: Selection,
  lookup: MovieLookup
): ResolvedSelection {
  if (selection.type === 'sequence') {
    const sequence = lookup.sequences.get(selection.id);
    if (sequence) {
      return {
        kicker: 'Sequence Storyboard',
        title: sequence.title,
        summary: sequence.summary ?? 'Sequence structure loaded from project data.',
        clips: sequence.scenes.flatMap((scene) => scene.clips),
      };
    }
  }

  if (selection.type === 'scene') {
    const scene = lookup.scenes.get(selection.id);
    if (scene) {
      return {
        kicker: 'Scene Storyboard',
        title: scene.title,
        summary: scene.summary ?? 'Scene structure loaded from project data.',
        clips: scene.clips,
      };
    }
  }

  if (selection.type === 'clip') {
    const clip = lookup.clips.get(selection.id);
    if (clip) {
      return {
        kicker: 'Clip Design Workspace',
        title: clip.title,
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
        kicker: 'Cast Workspace',
        title: castEntry.name,
        summary: castEntry.shortDescription ?? 'Cast structure loaded from project data.',
        clips: [],
        castEntry,
      };
    }
  }

  return {
    kicker: selection.type === 'casting' ? 'Casting' : 'Full Storyboard',
    title: selection.type === 'casting' ? 'All Cast' : 'Full Storyboard',
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
