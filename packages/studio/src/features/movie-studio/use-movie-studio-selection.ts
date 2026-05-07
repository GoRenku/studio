import { useMemo, useState } from 'react';
import type { ProjectWithHttp } from '@/services/studio-project-contracts';
import {
  buildMovieStudioLookup,
  resolveMovieStudioSelection,
  type MovieStudioSelection,
} from './movie-studio-selection';

export function useMovieStudioSelection(project: ProjectWithHttp | null) {
  const [selection, setSelection] = useState<MovieStudioSelection>({
    type: 'storyboard',
  });
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
    () => resolveMovieStudioSelection(selection, lookup),
    [lookup, selection]
  );

  return {
    selection,
    setSelection,
    lookup,
    resolvedSelection,
  };
}
