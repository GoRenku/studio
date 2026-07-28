import { useCallback, useEffect, useState } from 'react';
import { useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { listStudioShotImageCandidates } from '@/services/studio-shot-plans-api';
import type { StudioShotImageCandidateCollection } from '@/services/studio-shot-plans-contracts';

export function useShotImageCandidates(input: {
  projectName: string;
  sceneId: string;
  shotId: string;
  enabled: boolean;
}) {
  const [result, setResult] = useState<{
    requestKey: string;
    resource: StudioShotImageCandidateCollection | null;
    error: string | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const requestKey = input.enabled
    ? `${input.projectName}:${input.shotId}:${revision}`
    : null;

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    void listStudioShotImageCandidates({
      projectName: input.projectName,
      shotId: input.shotId,
      signal: controller.signal,
    })
      .then((nextResource) => {
        setResult({
          requestKey,
          resource: nextResource,
          error: null,
        });
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setResult({
            requestKey,
            resource: null,
            error: loadError instanceof Error
              ? loadError.message
              : 'Unable to load Shot images.',
          });
        }
      });
    return () => controller.abort();
  }, [
    input.projectName,
    input.shotId,
    requestKey,
  ]);

  useStudioResourceRefresh({
    projectName: input.projectName,
    enabled: input.enabled,
    matches: (resourceKeys) =>
      resourceKeys.includes(
        `surface:scene:${input.sceneId}:shot-plans`
      ),
    onRefresh: reload,
  });

  const currentResult = result?.requestKey === requestKey ? result : null;
  return {
    resource: currentResult?.resource ?? null,
    error: currentResult?.error ?? null,
    reload,
  };
}
