import { useCallback, useEffect, useState } from 'react';
import {
  matchesSceneVideoGenerationsResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { readSceneShotPlanVideoGenerations } from '@/services/studio-shot-plan-video-generations-api';
import type { StudioSceneShotPlanVideoGenerations } from '@/services/studio-shot-plan-video-generations-contracts';

export function useSceneShotPlanVideoGenerations(
  projectName: string,
  sceneId: string,
) {
  const [resource, setResource] =
    useState<StudioSceneShotPlanVideoGenerations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let current = true;
    void readSceneShotPlanVideoGenerations(projectName, sceneId).then(
      (nextResource) => {
        if (current) {
          setResource(nextResource);
          setError(null);
        }
      },
      (reason) => {
        if (current) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      },
    );
    return () => {
      current = false;
    };
  }, [projectName, revision, sceneId]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesSceneVideoGenerationsResource(resourceKeys, sceneId),
    onRefresh: retry,
  });

  return {
    resource,
    error,
    loading: !resource && !error,
    retry,
  };
}
