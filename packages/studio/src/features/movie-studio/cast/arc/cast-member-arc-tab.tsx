import { useCallback } from 'react';
import { readCastMemberCharacterArc } from '@/services/studio-continuity-api';
import {
  matchesCastMemberResource,
  matchesStoryArcResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { useContinuityResource } from '../../continuity/use-continuity-resource';
import { CharacterArcSummary } from './character-arc-summary';
import { CharacterArcTimeline } from './character-arc-timeline';
import { CharacterArcTurningPoints } from './character-arc-turning-points';

export function CastMemberArcTab({
  projectName,
  castMemberId,
}: {
  projectName: string;
  castMemberId: string;
}) {
  const read = useCallback(
    () => readCastMemberCharacterArc(projectName, castMemberId),
    [castMemberId, projectName]
  );
  const { resource, error, refresh } = useContinuityResource({
    read,
    fallbackErrorMessage: 'Unable to load the character arc.',
  });
  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesCastMemberResource(resourceKeys, castMemberId) || matchesStoryArcResource(resourceKeys),
    onRefresh: refresh,
  });

  if (error) {
    return <p className='px-8 pt-7 text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='px-8 pt-7 text-sm text-muted-foreground'>Loading arc...</p>;
  }
  return (
    <article className='min-h-full bg-panel-bg px-8 pb-12 pt-7 text-foreground'>
      <CharacterArcSummary resource={resource} />
      <CharacterArcTimeline resource={resource} />
      <CharacterArcTurningPoints projectName={projectName} resource={resource} />
    </article>
  );
}
