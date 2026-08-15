import type {
  CastNavigationRow,
  LocationNavigationRow,
  PropNavigationRow,
  Scene,
  ScreenplaySection,
  ScenePanelTab,
  StudioSelection,
} from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { sceneDisplayLabel } from './screenplay/scene-label';
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
  sections: Map<string, ScreenplaySection>;
  scenes: Map<string, Scene>;
}

export interface ResolvedStudioSelection {
  valid: boolean;
  kicker: string;
  summary: string;
  castMember?: CastNavigationRow;
  location?: LocationNavigationRow;
  prop?: PropNavigationRow;
  section?: ScreenplaySection;
  scene?: Scene;
}

export function buildMovieStudioLookup(
  project: ProjectShellWithHttp,
  navigation: MovieStudioNavigationState
): MovieStudioLookup {
  void project;
  return {
    cast: new Map(navigation.cast.map((row) => [row.id, row])),
    locations: new Map(navigation.locations.map((row) => [row.id, row])),
    props: new Map(navigation.props.map((row) => [row.id, row])),
    sections: navigation.sectionsById,
    scenes: navigation.scenesById,
  };
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
      return valid('Cast', 'Cast members loaded from project data.');
    case 'locations':
      return valid('Locations', 'Production locations.');
    case 'props':
      return valid('Props', 'Continuity props.');
    case 'storyArc':
      return valid('Screenplay Analysis', 'Three-act screenplay analysis.');
    case 'section': {
      const section = lookup.sections.get(selection.id);
      return section
        ? {
            ...valid(
              section.title,
              section.type === 'act' ? 'Screenplay Act.' : 'Screenplay Sequence.'
            ),
            section,
          }
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
      return prop ? { ...valid(prop.name, 'Prop'), prop } : invalid();
    }
    case 'scene': {
      const scene = lookup.scenes.get(selection.id);
      return scene
        ? { ...valid(sceneDisplayLabel(scene), 'Scene loaded from screenplay data.'), scene }
        : invalid();
    }
  }
}

export function toggleSetValue(current: Set<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
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
