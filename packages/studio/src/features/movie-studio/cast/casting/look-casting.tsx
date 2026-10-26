import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import type { CastCastingCostumeResponse, CastCastingLookResponse } from '@/services/studio-project-contracts';
import { AgentRequest } from '@/ui/agent-request';
import { Tabs } from '@/ui/tabs';
import { planWardrobeRequest } from '../../agent-request-copy';
import { CastingSubjectPicker } from './casting-subject-picker';
import { countLabel } from './casting-summaries';
import type { CastingSubject } from './casting-subjects';
import { SubjectRounds } from './subject-rounds';

/**
 * The picked Look: once it is cast and has costumes, a row with its Casting card and one card per
 * costume picks whose rounds the box below shows. At most one "Ask your agent" card shows.
 */
export function LookCasting({
  castMemberName,
  look,
  costumes,
  subjects,
  pickedSubject,
  scenes,
  pendingAssetFileId,
  onPickSubject,
  onStatusChange,
  onCast,
  onPickSheet,
}: {
  castMemberName: string;
  look: CastCastingLookResponse;
  /** The Look's own costumes. */
  costumes: CastCastingCostumeResponse[];
  subjects: CastingSubject[];
  pickedSubject: CastingSubject;
  scenes: SceneStripScene[];
  pendingAssetFileId: string | null;
  onPickSubject: (key: string) => void;
  onStatusChange: (assetFileId: string, status: CastingCandidateStatus) => void;
  onCast: (lookId: string, assetFileId: string) => void;
  onPickSheet: (costumeId: string, assetFileId: string) => void;
}) {
  const cast = look.castCandidateAssetFileId !== null;
  const rounds = (
    <SubjectRounds
      key={pickedSubject.key}
      castMemberName={castMemberName}
      lookName={look.name}
      subject={pickedSubject}
      scenes={scenes}
      pendingAssetFileId={pendingAssetFileId}
      onStatusChange={onStatusChange}
      onChoose={(assetFileId) => (pickedSubject.costume ? onPickSheet(pickedSubject.costume.id, assetFileId) : onCast(look.id, assetFileId))}
    />
  );
  return (
    <section aria-label={look.name} className='flex flex-col gap-4 border-t border-border/40 pt-5'>
      <header className='flex flex-wrap items-baseline gap-3'>
        <h3 className='text-[15px] font-bold'>{look.name}</h3>
        <span className='text-xs text-muted-foreground'>{countLabel(look.sceneIds.length, 'scene')}</span>
      </header>
      {cast && costumes.length > 0 ? (
        <Tabs value={pickedSubject.key} onValueChange={onPickSubject} className='gap-4'>
          <CastingSubjectPicker look={look} subjects={subjects} scenes={scenes} />
          {rounds}
        </Tabs>
      ) : rounds}
      {cast && costumes.length === 0 ? <AgentRequest request={planWardrobeRequest(castMemberName)} /> : null}
    </section>
  );
}
