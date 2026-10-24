import { castingLookTone } from '@/features/casting-views/casting-tones';
import { LookCard } from '@/features/casting-views/look-card';
import { SceneStrip } from '@/features/casting-views/scene-strip';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { castLooksRequest } from '../../agent-request-copy';
import { CastingRounds } from './casting-rounds';
import { CastingSectionHeading } from './casting-section-heading';
import { lookDetails, wardrobeBands } from './casting-summaries';
import { castingSceneLabels, sceneSummary } from '@/features/casting-views/scene-labels';
import { CostumeSheets } from './costume-sheets';
import { useCastCasting } from './use-cast-casting';

/** The Casting record of one Cast Member: Looks, wardrobe by scene, casting rounds and costume sheets. */
export function CastMemberCastingTab({
  projectName,
  castMemberId,
}: {
  projectName: string;
  castMemberId: string;
}) {
  const casting = useCastCasting({ projectName, castMemberId });
  const { resource } = casting;

  if (casting.error) {
    return <p className='px-8 pt-7 text-sm text-destructive'>{casting.error}</p>;
  }
  if (!resource) {
    return <p className='px-8 pt-7 text-sm text-muted-foreground'>Loading casting...</p>;
  }
  if (resource.looks.length === 0) {
    return (
      <PanelEmptyState
        title={`${resource.castMember.name} isn't cast yet`}
        description='Casting finds the person for each look of this character, then plans a costume per scene and makes a character sheet for each costume.'
        request={castLooksRequest(resource.castMember.name)}
      />
    );
  }
  const scenes = castingSceneLabels(resource.scenes);
  return (
    <article className='min-h-full bg-panel-bg px-8 pb-12 pt-7 text-foreground'>
      <section>
        <CastingSectionHeading>Looks</CastingSectionHeading>
        <div className='mt-3 flex flex-wrap gap-3'>
          {resource.looks.map((look, index) => (
            <LookCard
              key={look.id}
              name={look.name}
              sceneSummary={sceneSummary(look.sceneIds, scenes)}
              imageUrl={look.castCandidate?.url ?? null}
              tone={castingLookTone(index)}
              details={lookDetails(look, resource.costumes)}
            />
          ))}
        </div>
      </section>
      {scenes.length > 0 ? (
        <section className='mt-8'>
          <CastingSectionHeading>Wardrobe by scene</CastingSectionHeading>
          <SceneStrip className='mt-3' scenes={scenes} bands={wardrobeBands(resource)} />
        </section>
      ) : null}
      {resource.looks.map((look) => (
        <CastingRounds
          key={look.id}
          castMemberName={resource.castMember.name}
          look={look}
          pendingAssetFileId={casting.pendingAssetFileId}
          onStatusChange={(assetFileId, status) => void casting.setCandidateStatus(assetFileId, status)}
          onCast={(lookId, assetFileId) => void casting.castCandidate(lookId, assetFileId)}
        />
      ))}
      <CostumeSheets
        resource={resource}
        scenes={scenes}
        pendingAssetFileId={casting.pendingAssetFileId}
        onPick={(costumeId, assetFileId) => void casting.pickCharacterSheet(costumeId, assetFileId)}
      />
    </article>
  );
}
