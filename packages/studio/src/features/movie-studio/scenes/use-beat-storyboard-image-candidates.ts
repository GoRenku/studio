import { useCallback, useEffect, useState } from 'react';
import { useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { readStudioSceneStoryboardStatus } from '@/services/studio-scene-storyboard-images-api';
import type { StudioSceneStoryboardStatus } from '@/services/studio-scene-storyboard-images-contracts';

export function useBeatStoryboardImageCandidates(input: {
  projectName: string;
  sceneId: string;
  sceneBeatsRevisionId: string;
  enabled: boolean;
}) {
  const [result, setResult] = useState<{
    requestKey: string;
    resource: StudioSceneStoryboardStatus | null;
    error: string | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const requestKey = input.enabled
    ? `${input.projectName}:${input.sceneId}:${input.sceneBeatsRevisionId}:${revision}`
    : null;

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    void readStudioSceneStoryboardStatus({
      projectName: input.projectName,
      sceneId: input.sceneId,
      sceneBeatsRevisionId: input.sceneBeatsRevisionId,
      signal: controller.signal,
    })
      .then((resource) => setResult({ requestKey, resource, error: null }))
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setResult({
            requestKey,
            resource: null,
            error: loadError instanceof Error
              ? loadError.message
              : 'Unable to load Storyboard images.',
          });
        }
      });
    return () => controller.abort();
  }, [input.projectName, input.sceneBeatsRevisionId, input.sceneId, requestKey]);

  useStudioResourceRefresh({
    projectName: input.projectName,
    enabled: input.enabled,
    matches: (keys) => keys.includes(`surface:scene:${input.sceneId}:beats`),
    onRefresh: reload,
  });
  const current = result?.requestKey === requestKey ? result : null;
  return { resource: current?.resource ?? null, error: current?.error ?? null, reload };
}
