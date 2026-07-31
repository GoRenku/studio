import type {
  CastNavigationRow,
  LocationNavigationRow,
  PropNavigationRow,
  SceneNavigationRow,
  SequenceNavigationRow,
  ActNavigationRow,
  ScenePanelTab,
  StudioSelection,
} from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type { MovieStudioNavigationState } from './use-movie-studio-navigation';

export const SCENE_PANEL_TABS: ScenePanelTab[] = [
  'narrative',
  'beats',
  'shotPlans',
  'generations',
];

export interface MovieStudioLookup {
  cast: Map<string, CastNavigationRow>;
  locations: Map<string, LocationNavigationRow>;
  props: Map<string, PropNavigationRow>;
  acts: Map<string, ActNavigationRow>;
  sequences: Map<string, SequenceNavigationRow>;
  scenes: Map<string, SceneNavigationRow>;
  scenesBySequenceId: Map<string, SceneNavigationRow[]>;
}

export interface ResolvedStudioSelection {
  valid: boolean;
  kicker: string;
  summary: string;
  castMember?: CastNavigationRow;
  location?: LocationNavigationRow;
  prop?: PropNavigationRow;
  act?: ActNavigationRow;
  sequence?: SequenceNavigationRow;
  scene?: SceneNavigationRow;
}

export function buildMovieStudioLookup(
  project: ProjectShellWithHttp,
  navigation: MovieStudioNavigationState
): MovieStudioLookup {
  const cast = new Map<string, CastNavigationRow>();
  const locations = new Map<string, LocationNavigationRow>();
  const props = new Map<string, PropNavigationRow>();
  const acts = new Map<string, ActNavigationRow>();
  const sequences = new Map<string, SequenceNavigationRow>();
  const scenes = new Map<string, SceneNavigationRow>();
  const scenesBySequenceId = new Map<string, SceneNavigationRow[]>();

  for (const castMember of navigation.cast) {
    cast.set(castMember.id, castMember);
  }
  for (const location of navigation.locations) {
    locations.set(location.id, location);
  }
  for (const prop of navigation.props) {
    props.set(prop.id, prop);
  }
  for (const act of navigation.acts) {
    acts.set(act.id, act);
  }
  for (const rows of navigation.sequencesByActId.values()) {
    for (const sequence of rows) {
      sequences.set(sequence.id, sequence);
    }
  }
  for (const [sequenceId, rows] of navigation.scenesBySequenceId) {
    scenesBySequenceId.set(sequenceId, rows);
    for (const scene of rows) {
      scenes.set(scene.id, scene);
    }
  }

  void project;
  return { cast, locations, props, acts, sequences, scenes, scenesBySequenceId };
}

export function resolveStudioSelection(
  selection: StudioSelection,
  lookup: MovieStudioLookup
): ResolvedStudioSelection {
  switch (selection.type) {
    case 'projectInformation':
      return valid('Project Details', 'Project information loaded from project data.');
    case 'inspiration':
      return valid('Inspiration', 'Reference grabs and analysis.');
    case 'lookbook':
      return valid(
        selection.kind === 'production' ? 'Production' : 'Storyboard',
        'Project visual language guide.'
      );
    case 'trash':
      return valid('Trash', 'Discarded project items.');
    case 'cast':
      return valid('Cast', 'Cast members loaded from screenplay data.');
    case 'locations':
      return valid('Locations', 'Production locations.');
    case 'props':
      return valid('Props', 'Continuity props.');
    case 'storyArc':
      return valid('Story Arc', 'Acts and sequences loaded from screenplay data.');
    case 'act': {
      const act = lookup.acts.get(selection.id);
      return act
        ? { ...valid(act.title, `${act.sceneCount} scenes.`), act }
        : invalid();
    }
    case 'castMember': {
      const castMember = lookup.cast.get(selection.id);
      return castMember
        ? { ...valid(castMember.name, castMember.role ?? 'Cast member'), castMember }
        : invalid();
    }
    case 'location': {
      const location = lookup.locations.get(selection.id);
      return location
        ? { ...valid(location.name, location.timePeriod ?? 'Location'), location }
        : invalid();
    }
    case 'prop': {
      const prop = lookup.props.get(selection.id);
      return prop
        ? { ...valid(prop.name, 'Prop'), prop }
        : invalid();
    }
    case 'sequence': {
      const sequence = lookup.sequences.get(selection.id);
      return sequence
        ? { ...valid(sequence.title, `${sequence.sceneCount} scenes.`), sequence }
        : invalid();
    }
    case 'scene': {
      const scene = lookup.scenes.get(selection.id);
      return scene
        ? { ...valid(scene.title, 'Scene loaded from screenplay data.'), scene }
        : invalid();
    }
  }
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

function valid(kicker: string, summary: string): ResolvedStudioSelection {
  return { valid: true, kicker, summary };
}

function invalid(): ResolvedStudioSelection {
  return {
    valid: false,
    kicker: 'Selection not found',
    summary: 'The selected screenplay item could not be found.',
  };
}
