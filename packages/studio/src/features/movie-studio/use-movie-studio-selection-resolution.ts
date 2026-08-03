import { useMemo } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  buildMovieStudioLookup,
  resolveStudioSelection,
} from './movie-studio-selection';
import type { MovieStudioNavigationState } from './use-movie-studio-navigation';

const defaultStudioSelection: StudioSelection = {
  type: 'projectInformation',
};

export function useStudioSelectionResolution(
  project: ProjectShellWithHttp | null,
  selection: StudioSelection | null,
  screenplayNavigation: MovieStudioNavigationState | null
) {
  const routeSelection = selection ?? defaultStudioSelection;
  const lookup = useMemo(
    () =>
      project && screenplayNavigation
        ? buildMovieStudioLookup(project, screenplayNavigation)
        : {
            sections: new Map(),
            scenes: new Map(),
            cast: new Map(),
            locations: new Map(),
            props: new Map(),
          },
    [project, screenplayNavigation]
  );
  const resolvedSelection = useMemo(
    () => resolveStudioSelection(routeSelection, lookup),
    [lookup, routeSelection]
  );

  return {
    selection: routeSelection,
    lookup,
    resolvedSelection,
  };
}
