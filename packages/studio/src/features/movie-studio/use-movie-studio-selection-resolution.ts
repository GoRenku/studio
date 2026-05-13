import { useMemo } from 'react';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  buildMovieStudioLookup,
  resolveMovieStudioSelection,
  type MovieStudioSelection,
} from './movie-studio-selection';
import type { StoryNavigationState } from './use-story-navigation';

const defaultMovieStudioSelection: MovieStudioSelection = {
  type: 'projectInformation',
};

export function useMovieStudioSelectionResolution(
  project: ProjectShellWithHttp | null,
  selection: MovieStudioSelection | null,
  storyNavigation: StoryNavigationState | null
) {
  const routeSelection = selection ?? defaultMovieStudioSelection;
  const lookup = useMemo(
    () =>
      project && storyNavigation
        ? buildMovieStudioLookup(project, storyNavigation)
        : {
            sequences: new Map(),
            scenes: new Map(),
            clips: new Map(),
            cast: new Map(),
            clipsBySequenceId: new Map(),
            clipsBySceneId: new Map(),
          },
    [project, storyNavigation]
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
