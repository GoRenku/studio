import { useMemo } from 'react';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import {
  buildMovieStudioLookup,
  resolveMovieStudioSelection,
  type MovieStudioSelection,
} from './movie-studio-selection';

const defaultMovieStudioSelection: MovieStudioSelection = {
  type: 'projectInformation',
};

export function useMovieStudioSelectionResolution(
  project: ProjectWithHttp | null,
  selection: MovieStudioSelection | null
) {
  const routeSelection = selection ?? defaultMovieStudioSelection;
  const lookup = useMemo(
    () =>
      project
        ? buildMovieStudioLookup(project)
        : {
            sequences: new Map(),
            scenes: new Map(),
            clips: new Map(),
            cast: new Map(),
          },
    [project]
  );
  const resolvedSelection = useMemo(
    () => resolveMovieStudioSelection(routeSelection, lookup),
    [lookup, routeSelection]
  );

  return {
    selection: routeSelection,
    lookup,
    resolvedSelection,
  };
}
