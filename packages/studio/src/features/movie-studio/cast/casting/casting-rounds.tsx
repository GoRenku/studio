import { useState } from 'react';
import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import { CandidatePreviewActions } from '@/features/casting-views/candidate-actions';
import { CandidateTile } from '@/features/casting-views/candidate-tile';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import type {
  CastCastingLookResponse,
  CastingRoundViewResponse,
} from '@/services/studio-project-contracts';
import { isKeptCandidate, roundSummary } from './casting-summaries';

interface CastingRoundsProps {
  look: CastCastingLookResponse;
  /** Hidden candidates show (dimmed) only when the director asks to see them. */
  showHidden: boolean;
  pendingAssetFileId: string | null;
  onStatusChange: (assetFileId: string, status: CastingCandidateStatus) => void;
  onCast: (lookId: string, assetFileId: string) => void;
}

/** Every casting round of one Look, with hide and cast on each candidate. */
export function CastingRounds({ look, showHidden, pendingAssetFileId, onStatusChange, onCast }: CastingRoundsProps) {
  return (
    <div className='flex flex-col gap-5'>
      {look.rounds.map((round) => (
        <CastingRound
          key={round.id}
          look={look}
          round={round}
          showHidden={showHidden}
          pendingAssetFileId={pendingAssetFileId}
          onStatusChange={onStatusChange}
          onCast={onCast}
        />
      ))}
    </div>
  );
}

function CastingRound({
  look,
  round,
  showHidden,
  pendingAssetFileId,
  onStatusChange,
  onCast,
}: CastingRoundsProps & { round: CastingRoundViewResponse }) {
  // The viewer keeps the candidates it opened with, so hiding one never moves the shown one away.
  const [preview, setPreview] = useState<{ assetFileIds: string[]; index: number } | null>(null);
  const shown = showHidden
    ? round.candidates
    : round.candidates.filter((candidate) => isKeptCandidate(candidate, look.castCandidateAssetFileId));
  const previewCandidates = preview
    ? preview.assetFileIds.flatMap((assetFileId) => round.candidates.find((candidate) => candidate.assetFileId === assetFileId) ?? [])
    : [];
  const previewCandidate = preview ? previewCandidates[preview.index] ?? null : null;
  const toggleHidden = (candidate: CastingRoundViewResponse['candidates'][number]) =>
    onStatusChange(candidate.assetFileId, candidate.status === 'hidden' ? 'candidate' : 'hidden');
  return (
    <div className='flex flex-col gap-2'>
      <p className='text-xs text-muted-foreground'>{roundSummary(round)}</p>
      {shown.length > 0 ? (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5'>
          {shown.map((candidate, index) => (
            <CandidateTile
              key={candidate.assetFileId}
              imageUrl={candidate.assetFile.url}
              modelLabel={candidate.model.name}
              status={candidate.status}
              isCast={candidate.assetFileId === look.castCandidateAssetFileId}
              disabled={pendingAssetFileId === candidate.assetFileId}
              onHide={() => toggleHidden(candidate)}
              onCast={() => onCast(look.id, candidate.assetFileId)}
              onOpen={() => setPreview({ assetFileIds: shown.map((entry) => entry.assetFileId), index })}
            />
          ))}
        </div>
      ) : null}
      {preview && previewCandidate ? (
        <ImagePreviewDialog
          images={previewCandidates.map((candidate) => ({
            src: candidate.assetFile.url,
            alt: `Casting candidate from ${candidate.model.name}`,
            title: `${look.name} · Round ${round.number}`,
          }))}
          currentIndex={preview.index}
          onCurrentIndexChange={(index) => setPreview({ ...preview, index })}
          actions={
            <CandidatePreviewActions
              status={previewCandidate.status}
              isCast={previewCandidate.assetFileId === look.castCandidateAssetFileId}
              disabled={pendingAssetFileId === previewCandidate.assetFileId}
              onHide={() => toggleHidden(previewCandidate)}
              onCast={() => onCast(look.id, previewCandidate.assetFileId)}
            />
          }
          onOpenChange={(open) => {
            if (!open) {
              setPreview(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
