import { useCallback, useEffect, useState } from 'react';
import {
  readShotPlanDialogueAudio,
  type StudioShotPlanDialogueAudioResource,
} from '@/services/studio-shot-plan-dialogue-audio-api';
import {
  matchesShotPlanDialogueAudioResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';

export function useShotPlanDialogueAudio(input: {
  projectName: string;
  shotPlanId: string;
}) {
  const [resource, setResource] = useState<StudioShotPlanDialogueAudioResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((current) => current + 1), []);
  const matchesResource = useCallback(
    (resourceKeys: string[]) => matchesShotPlanDialogueAudioResource(
      resourceKeys,
      input.shotPlanId,
    ),
    [input.shotPlanId],
  );
  useStudioResourceRefresh({
    projectName: input.projectName,
    matches: matchesResource,
    onRefresh: reload,
  });
  useEffect(() => {
    const controller = new AbortController();
    void readShotPlanDialogueAudio({
      projectName: input.projectName,
      shotPlanId: input.shotPlanId,
      signal: controller.signal,
    })
      .then((next) => {
        setResource(next);
        setError(null);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to load Shot Plan audio.');
        }
      });
    return () => controller.abort();
  }, [input.projectName, input.shotPlanId, revision]);
  return { resource, error, reload };
}
