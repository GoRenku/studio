import { useEffect, useMemo, useState } from 'react';
import type {
  CastNavigationRow,
  LocationNavigationRow,
  PropNavigationRow,
  Scene,
  ScreenplaySection,
  ScreenplayStructureResource,
  StudioSelection,
  StudioSelectionContext,
} from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { readStudioSelectionContext } from '@/services/studio-projects-api';
import { readScreenplayStructure } from '@/services/screenplay';
import {
  matchesMovieStudioNavigationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';

export interface MovieStudioNavigationState {
  cast: CastNavigationRow[];
  locations: LocationNavigationRow[];
  props: PropNavigationRow[];
  screenplay: ScreenplayStructureResource;
  sectionsById: Map<string, ScreenplaySection>;
  scenesById: Map<string, Scene>;
  orderedScenes: Scene[];
  error: string | null;
  selectionContext: StudioSelectionContext | null;
}

export function useMovieStudioNavigation(
  project: ProjectShellWithHttp,
  selection: StudioSelection
): MovieStudioNavigationState {
  const projectName = project.project.projectName;
  const [screenplayState, setScreenplayState] = useState(() => ({
    projectName,
    shellSource: project.navigation.screenplay,
    resource: project.navigation.screenplay,
  }));
  if (
    screenplayState.projectName !== projectName ||
    screenplayState.shellSource !== project.navigation.screenplay
  ) {
    setScreenplayState({
      projectName,
      shellSource: project.navigation.screenplay,
      resource: project.navigation.screenplay,
    });
  }
  const screenplay =
    screenplayState.projectName === projectName &&
    screenplayState.shellSource === project.navigation.screenplay
      ? screenplayState.resource
      : project.navigation.screenplay;
  const selectionKey = selectionIdentity(selection);
  const [selectionContextState, setSelectionContextState] = useState<{
    key: string;
    context: StudioSelectionContext | null;
    error: string | null;
  }>({ key: selectionKey, context: null, error: null });
  const selectionContext =
    selectionContextState.key === selectionKey
      ? selectionContextState.context
      : null;
  const error =
    selectionContextState.key === selectionKey
      ? selectionContextState.error
      : null;

  useEffect(() => {
    if (!needsSelectionContext(selection)) {
      return;
    }
    let cancelled = false;
    void readStudioSelectionContext(projectName, { selection })
      .then((result) => {
        if (cancelled) return;
        if (result.valid) {
          setSelectionContextState({
            key: selectionKey,
            context: result.context,
            error: null,
          });
        } else {
          setSelectionContextState({
            key: selectionKey,
            context: null,
            error: 'The selected screenplay item could not be found.',
          });
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setSelectionContextState({
            key: selectionKey,
            context: null,
            error: errorMessage(loadError),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, selection, selectionKey]);

  useStudioResourceRefresh({
    projectName,
    matches: matchesMovieStudioNavigationResource,
    onRefresh: async () => {
      try {
        const resource = await readScreenplayStructure(projectName);
        setScreenplayState((current) => ({ ...current, resource }));
      } catch (loadError) {
        setSelectionContextState((current) => ({
          ...current,
          error: errorMessage(loadError),
        }));
      }
    },
  });

  return useMemo(() => {
    const sectionsById = new Map(
      screenplay.screenplay.sections.map((section) => [section.id, section])
    );
    const scenesById = new Map(
      screenplay.screenplay.scenes.map((scene) => [scene.id, scene])
    );
    const orderedScenes = screenplay.orderedSceneIds.flatMap((sceneId) => {
      const scene = scenesById.get(sceneId);
      return scene ? [scene] : [];
    });
    return {
      cast: project.navigation.cast.items,
      locations: project.navigation.locations.items,
      props: project.navigation.props.items,
      screenplay,
      sectionsById,
      scenesById,
      orderedScenes,
      error,
      selectionContext,
    };
  }, [error, project.navigation, screenplay, selectionContext]);
}

function needsSelectionContext(selection: StudioSelection): boolean {
  if (selection.type === 'lookbook') return true;
  if (selection.type === 'inspiration' && selection.folderId) return true;
  return ['castMember', 'location', 'prop', 'section', 'scene'].includes(
    selection.type
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Screenplay navigation failed to load.';
}

function selectionIdentity(selection: StudioSelection): string {
  return 'id' in selection
    ? `${selection.type}:${selection.id}`
    : selection.type;
}
