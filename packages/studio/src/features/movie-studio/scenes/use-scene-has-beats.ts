import { useCallback, useEffect, useState } from 'react';
import { readSceneBeatsResource } from '@/services/screenplay';
import {
  matchesSceneBeatsResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';

/** Whether the Scene has active Beats, keeping load failures separate from an empty revision. */
export function useSceneHasBeats(projectName: string, sceneId: string) {
  const [result, setResult] = useState<{
    projectName: string;
    sceneId: string;
    revision: number;
    hasBeats: boolean | null;
    error: string | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readSceneBeatsResource(projectName, sceneId)
      .then((resource) => {
        if (!cancelled) {
          setResult({
            projectName,
            sceneId,
            revision,
            hasBeats: (resource.activeRevision?.beats.length ?? 0) > 0,
            error: null,
          });
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setResult({
            projectName,
            sceneId,
            revision,
            hasBeats: null,
            error: loadError instanceof Error ? loadError.message : 'Unable to load Scene Beats.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId, revision]);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) => matchesSceneBeatsResource({ resourceKeys, sceneId }),
    onRefresh: refresh,
  });

  const current = result?.projectName === projectName
    && result.sceneId === sceneId && result.revision === revision;
  return {
    hasBeats: current ? result.hasBeats : null,
    error: current ? result.error : null,
    retry: refresh,
  };
}
