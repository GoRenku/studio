import { useState } from 'react';
import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import { CandidatePreviewActions } from '@/features/casting-views/candidate-actions';
import { CandidateTile } from '@/features/casting-views/candidate-tile';
import { AgentRequestHint } from '@/ui/agent-request';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import type {
  CastCastingLookResponse,
  CastingRoundViewResponse,
} from '@/services/studio-project-contracts';
import { castLookRequest, moreLikeShortlistRequest } from '../../agent-request-copy';
import { roundSummary } from './casting-summaries';
import { CastingSectionHeading } from './casting-section-heading';

interface CastingRoundsProps {
  castMemberName: string;
  look: CastCastingLookResponse;
  pendingAssetFileId: string | null;
  onStatusChange: (assetFileId: string, status: CastingCandidateStatus) => void;
  onCast: (lookId: string, assetFileId: string) => void;
}

/** Every casting round for one Look, with shortlist, hide and cast on each candidate. */
export function CastingRounds({
  castMemberName,
  look,
  pendingAssetFileId,
  onStatusChange,
  onCast,
}: CastingRoundsProps) {
  const hasShortlist = look.rounds.some((round) =>
    round.candidates.some((candidate) => candidate.status === 'shortlisted')
  );
  return (
    <section className='mt-8'>
      <CastingSectionHeading>Casting rounds · {look.name}</CastingSectionHeading>
      {look.rounds.length === 0 ? (
        <AgentRequestHint request={castLookRequest(castMemberName, look.name)} className='mt-3' />
      ) : (
        <div className='mt-3 flex flex-col gap-5'>
          {look.rounds.map((round) => (
            <CastingRound
              key={round.id}
              look={look}
              round={round}
              pendingAssetFileId={pendingAssetFileId}
              onStatusChange={onStatusChange}
              onCast={onCast}
            />
          ))}
          {hasShortlist ? (
            <AgentRequestHint request={moreLikeShortlistRequest(castMemberName, look.name)} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function CastingRound({
  look,
  round,
  pendingAssetFileId,
  onStatusChange,
  onCast,
}: Omit<CastingRoundsProps, 'castMemberName'> & { round: CastingRoundViewResponse }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewCandidate = previewIndex === null ? null : round.candidates[previewIndex] ?? null;
  const toggleStatus = (
    candidate: CastingRoundViewResponse['candidates'][number],
    status: 'shortlisted' | 'hidden'
  ) => onStatusChange(candidate.assetFileId, candidate.status === status ? 'candidate' : status);
  return (
    <div className='flex flex-col gap-2'>
      <p className='text-xs text-muted-foreground'>{roundSummary(round)}</p>
      {round.candidates.length > 0 ? (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5'>
          {round.candidates.map((candidate, index) => (
            <CandidateTile
              key={candidate.assetFileId}
              imageUrl={candidate.assetFile.url}
              modelLabel={candidate.model.name}
              status={candidate.status}
              isCast={candidate.assetFileId === look.castCandidateAssetFileId}
              disabled={pendingAssetFileId === candidate.assetFileId}
              onShortlist={() => toggleStatus(candidate, 'shortlisted')}
              onHide={() => toggleStatus(candidate, 'hidden')}
              onCast={() => onCast(look.id, candidate.assetFileId)}
              onOpen={() => setPreviewIndex(index)}
            />
          ))}
        </div>
      ) : null}
      {previewCandidate !== null && previewIndex !== null ? (
        <ImagePreviewDialog
          images={round.candidates.map((candidate) => ({
            src: candidate.assetFile.url,
            alt: `Casting candidate from ${candidate.model.name}`,
            title: `${look.name} · Round ${round.number}`,
          }))}
          currentIndex={previewIndex}
          onCurrentIndexChange={setPreviewIndex}
          actions={
            <CandidatePreviewActions
              status={previewCandidate.status}
              isCast={previewCandidate.assetFileId === look.castCandidateAssetFileId}
              disabled={pendingAssetFileId === previewCandidate.assetFileId}
              onShortlist={() => toggleStatus(previewCandidate, 'shortlisted')}
              onHide={() => toggleStatus(previewCandidate, 'hidden')}
              onCast={() => onCast(look.id, previewCandidate.assetFileId)}
            />
          }
          onOpenChange={(open) => {
            if (!open) {
              setPreviewIndex(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
