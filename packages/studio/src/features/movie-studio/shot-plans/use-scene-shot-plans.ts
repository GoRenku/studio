import { useCallback, useEffect, useState } from 'react';
import { useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { listStudioSceneShotPlans } from '@/services/studio-shot-plans-api';
import type { StudioShotPlansResponse } from '@/services/studio-shot-plans-contracts';

export function useSceneShotPlans(projectName: string, sceneId: string) {
  const [resource, setResource] = useState<StudioShotPlansResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listStudioSceneShotPlans({
      projectName,
      sceneId,
      signal: controller.signal,
    })
      .then((nextResource) => {
        setResource(nextResource);
        setError(null);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load Shot Plans.'
        );
      });
    return () => controller.abort();
  }, [projectName, revision, sceneId]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      resourceKeys.includes(`surface:scene:${sceneId}:shot-plans`),
    onRefresh: reload,
  });

  return { resource, error, reload };
}
