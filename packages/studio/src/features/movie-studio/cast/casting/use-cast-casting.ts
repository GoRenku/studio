import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import {
  castLookCandidate,
  readCastCasting,
  selectCostumeCharacterSheet,
  setCastingCandidateStatus,
} from '@/services/studio-cast-casting-api';
import {
  matchesCastMemberResource,
  matchesStoryArcResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { useContinuityResource } from '../../continuity/use-continuity-resource';

/** Reads a Cast Member's casting record and sends the director's picks to the Studio routes. */
export function useCastCasting({
  projectName,
  castMemberId,
}: {
  projectName: string;
  castMemberId: string;
}) {
  const read = useCallback(
    () => readCastCasting(projectName, castMemberId),
    [castMemberId, projectName]
  );
  const { resource, error, refresh } = useContinuityResource({
    read,
    fallbackErrorMessage: 'Unable to load casting.',
  });
  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesCastMemberResource(resourceKeys, castMemberId) || matchesStoryArcResource(resourceKeys),
    onRefresh: refresh,
  });
  const [pendingAssetFileId, setPendingAssetFileId] = useState<string | null>(null);

  const runPick = async (assetFileId: string, pick: () => Promise<unknown>) => {
    setPendingAssetFileId(assetFileId);
    try {
      await pick();
      await refresh();
    } catch (pickError) {
      toast.error(pickError instanceof Error ? pickError.message : 'Casting request failed.');
    } finally {
      setPendingAssetFileId(null);
    }
  };

  return {
    resource,
    error,
    pendingAssetFileId,
    setCandidateStatus: (assetFileId: string, status: CastingCandidateStatus) =>
      runPick(assetFileId, () => setCastingCandidateStatus(projectName, castMemberId, assetFileId, status)),
    castCandidate: (lookId: string, assetFileId: string) =>
      runPick(assetFileId, () => castLookCandidate(projectName, castMemberId, lookId, assetFileId)),
    pickCharacterSheet: (costumeId: string, assetFileId: string) =>
      runPick(assetFileId, () => selectCostumeCharacterSheet(projectName, castMemberId, costumeId, assetFileId)),
  };
}
