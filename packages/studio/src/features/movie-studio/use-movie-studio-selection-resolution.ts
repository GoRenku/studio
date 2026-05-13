import { useMemo } from 'react';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  buildMovieStudioLookup,
  resolveStudioSelection,
  type StudioSelection,
} from './movie-studio-selection';
import type { StoryNavigationState } from './use-story-navigation';

const defaultStudioSelection: StudioSelection = {
  type: 'projectInformation',
};

export function useStudioSelectionResolution(
  project: ProjectShellWithHttp | null,
  selection: StudioSelection | null,
  storyNavigation: StoryNavigationState | null
) {
  const routeSelection = selection ?? defaultStudioSelection;
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
    () => resolveStudioSelection(routeSelection, lookup),
    [lookup, routeSelection]
  );

  return {
    selection: routeSelection,
    lookup,
    resolvedSelection,
  };
}
