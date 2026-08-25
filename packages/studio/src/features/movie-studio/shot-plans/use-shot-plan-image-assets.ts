import { useCallback, useEffect, useState } from 'react';
import { useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { readStudioShotPlanImageAssets } from '@/services/studio-shot-plans-api';
import type { StudioShotPlanImageAssets } from '@/services/studio-shot-plans-contracts';

export function useShotPlanImageAssets(input: {
  projectName: string;
  shotPlanId: string;
  enabled: boolean;
}) {
  const [result, setResult] = useState<{
    requestKey: string;
    resource: StudioShotPlanImageAssets | null;
    error: string | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const requestKey = input.enabled
    ? `${input.projectName}:${input.shotPlanId}:${revision}`
    : null;

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    void readStudioShotPlanImageAssets({
      projectName: input.projectName,
      shotPlanId: input.shotPlanId,
      signal: controller.signal,
    }).then((resource) => {
      setResult({ requestKey, resource, error: null });
    }).catch((loadError) => {
      if (!controller.signal.aborted) {
        setResult({
          requestKey,
          resource: null,
          error: loadError instanceof Error
            ? loadError.message
            : 'Unable to load Shot Plan assets.',
        });
      }
    });
    return () => controller.abort();
  }, [input.projectName, input.shotPlanId, requestKey]);

  useStudioResourceRefresh({
    projectName: input.projectName,
    enabled: input.enabled,
    matches: (keys) => keys.includes(`surface:shotPlan:${input.shotPlanId}:image-assets`),
    onRefresh: reload,
  });
  const current = result?.requestKey === requestKey ? result : null;
  return { resource: current?.resource ?? null, error: current?.error ?? null, reload };
}
