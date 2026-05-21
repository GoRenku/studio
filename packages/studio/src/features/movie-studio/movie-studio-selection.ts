import type {
  CastMember,
  SceneNavigationRow,
  SequenceNavigationRow,
} from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type { StoryNavigationState } from './use-story-navigation';

export type StudioSelection =
  | { type: 'projectInformation' }
  | { type: 'visualLanguage' }
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };

export interface MovieStudioLookup {
  sequences: Map<string, SequenceNavigationRow>;
  scenes: Map<string, SceneNavigationRow>;
  cast: Map<string, CastMember>;
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
}

export interface ResolvedStudioSelection {
  valid: boolean;
  kicker: string;
  summary: string;
  scenes: SceneNavigationRow[];
  scene?: SceneNavigationRow;
  castEntry?: CastMember;
}

export function buildMovieStudioLookup(
  project: ProjectShellWithHttp,
  storyNavigation: StoryNavigationState
): MovieStudioLookup {
  const sequences = new Map<string, SequenceNavigationRow>();
  const scenes = new Map<string, SceneNavigationRow>();
  const scenesBySequenceId = new Map<string, SceneNavigationRow[]>();
  const cast = new Map(project.cast.map((entry) => [entry.id, entry]));

  for (const sequence of storyNavigation.sequences) {
    sequences.set(sequence.id, sequence);
    const sequenceScenes = storyNavigation.scenesBySequenceId.get(sequence.id) ?? [];
    scenesBySequenceId.set(sequence.id, sequenceScenes);
    for (const scene of sequenceScenes) {
      scenes.set(scene.id, scene);
    }
  }

  return { sequences, scenes, cast, scenesBySequenceId };
}

export function resolveStudioSelection(
  selection: StudioSelection,
  lookup: MovieStudioLookup
): ResolvedStudioSelection {
  if (selection.type === 'sequence') {
    const sequence = lookup.sequences.get(selection.id);
    if (sequence) {
      return {
        valid: true,
        kicker: sequence.title,
        summary: `${sequence.sceneCount} scenes.`,
        scenes: lookup.scenesBySequenceId.get(sequence.id) ?? [],
      };
    }
  }

  if (selection.type === 'scene') {
    const scene = lookup.scenes.get(selection.id);
    if (scene) {
      return {
        valid: true,
        kicker: scene.title,
        summary: 'Scene structure loaded from project data.',
        scenes: [scene],
        scene,
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
        scenes: [],
        castEntry,
      };
    }
  }

  if (selection.type === 'projectInformation') {
    return {
      valid: true,
      kicker: 'Project Information',
      summary: 'Project information loaded from project data.',
      scenes: [],
    };
  }

  if (selection.type === 'visualLanguage') {
    return {
      valid: true,
      kicker: 'Visual Language',
      summary: 'Visual language loaded from project data.',
      scenes: [],
    };
  }

  return {
    valid: selection.type === 'casting' || selection.type === 'storyboard',
    kicker: selection.type === 'casting' ? 'Cast' : 'Full Storyboard',
    summary:
      selection.type === 'casting'
        ? 'Cast entries loaded from project data.'
        : 'Story navigation loads sequence and scene pages as you open them.',
    scenes: Array.from(lookup.scenes.values()),
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
