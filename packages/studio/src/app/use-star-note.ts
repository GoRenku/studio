import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudioResourceRefresh } from '@/hooks/use-studio-resource-refresh';
import { offerStarNote } from './star-note';

const askOnAnyResourceChange = () => true;

/**
 * Asks Core about the star note when a project opens and whenever its
 * resources change, so generation done by the agent is noticed too. Core
 * decides eligibility; this hook only decides when to ask.
 */
export function useStarNote(projectName: string | null): void {
  const shownRef = useRef(false);
  const inFlightRef = useRef(false);

  const ask = useCallback(async () => {
    if (!projectName || shownRef.current || inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      shownRef.current = await offerStarNote(projectName);
    } finally {
      inFlightRef.current = false;
    }
  }, [projectName]);

  useEffect(() => {
    void ask();
  }, [ask]);

  const refresh = useMemo(() => ({
    projectName: projectName ?? '',
    matches: askOnAnyResourceChange,
    onRefresh: ask,
    enabled: projectName !== null,
  }), [ask, projectName]);
  useStudioResourceRefresh(refresh);
}
