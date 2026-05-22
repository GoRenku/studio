import { useMemo } from 'react';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  buildMovieStudioLookup,
  resolveStudioSelection,
  type StudioSelection,
} from './movie-studio-selection';
import type { ScreenplayNavigationState } from './use-screenplay-navigation';

const defaultStudioSelection: StudioSelection = {
  type: 'projectInformation',
};

export function useStudioSelectionResolution(
  project: ProjectShellWithHttp | null,
  selection: StudioSelection | null,
  screenplayNavigation: ScreenplayNavigationState | null
) {
  const routeSelection = selection ?? defaultStudioSelection;
  const lookup = useMemo(
    () =>
      project && screenplayNavigation
        ? buildMovieStudioLookup(project, screenplayNavigation)
        : {
            acts: new Map(),
            sequences: new Map(),
            scenes: new Map(),
            cast: new Map(),
            locations: new Map(),
            scenesBySequenceId: new Map(),
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
