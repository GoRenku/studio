import { useCallback, useEffect, useState } from 'react';
import { useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { readStudioShotPlanPrevis } from '@/services/shot-plan-previs/api';
import type { StudioShotPlanPrevis } from '@/services/shot-plan-previs/contracts';

export function usePrevis(projectName: string, sceneId: string, shotPlanId: string) {
  const [selection, setSelection] = useState<{ resource: StudioShotPlanPrevis | null; revisionId: string | null; generationId: string | null }>({ resource: null, revisionId: null, generationId: null });
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    void readStudioShotPlanPrevis({ projectName, shotPlanId, signal: controller.signal }).then((next) => {
      if (controller.signal.aborted) return;
      const latest = next.revisions.at(-1)?.id ?? null;
      setSelection((current) => {
        const previousLatest = current.resource?.revisions.at(-1)?.id;
        const revisionId = !current.revisionId || current.revisionId === previousLatest || !next.revisions.some((revision) => revision.id === current.revisionId) ? latest : current.revisionId;
        const revision = next.revisions.find((entry) => entry.id === revisionId);
        const generationId = revision?.generations.some((entry) => entry.id === current.generationId) ? current.generationId : revision?.generations[0]?.id ?? null;
        return { resource: next, revisionId, generationId };
      });
      setError(null);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load Previs.');
    });
    return () => controller.abort();
  }, [projectName, shotPlanId, refresh]);
  useStudioResourceRefresh({
    projectName,
    matches: (keys) => keys.includes(`surface:scene:${sceneId}:shot-plans`)
      || keys.includes(`surface:scene:${sceneId}:video-generations`)
      || keys.includes(`surface:shotPlan:${shotPlanId}:dialogue-audio`),
    onRefresh: reload,
  });
  const { resource, revisionId, generationId } = selection;
  const revision = resource?.revisions.find((entry) => entry.id === revisionId) ?? null;
  const generation = revision?.generations.find((entry) => entry.id === generationId) ?? null;
  const setRevisionId = (id: string) => setSelection((current) => ({ ...current, revisionId: id, generationId: current.resource?.revisions.find((entry) => entry.id === id)?.generations[0]?.id ?? null }));
  const setGenerationId = (id: string) => setSelection((current) => ({ ...current, generationId: id }));
  return { resource, error, reload, revision, generation, setRevisionId, setGenerationId };
}
