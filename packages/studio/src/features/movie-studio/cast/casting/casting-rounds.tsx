import { useState } from 'react';
import type { CastingCandidateStatus, CastingRoundKind } from '@gorenku/studio-core/client';
import { CandidatePreviewActions } from '@/features/casting-views/candidate-actions';
import { CandidateTile } from '@/features/casting-views/candidate-tile';
import { CASTING_ROUND_KIND_LABELS } from '@/features/casting-views/round-kind-labels';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import type { CastingRoundViewResponse } from '@/services/studio-project-contracts';
import { isKeptCandidate, roundSummary } from './casting-summaries';

interface CastingRoundsProps {
  kind: CastingRoundKind;
  /** The Look or costume name, for the image viewer's title. */
  subjectName: string;
  rounds: CastingRoundViewResponse[];
  chosenAssetFileId: string | null;
  /** Hidden images show (dimmed) only when the director asks to see them. */
  showHidden: boolean;
  pendingAssetFileId: string | null;
  onStatusChange: (assetFileId: string, status: CastingCandidateStatus) => void;
  onChoose: (assetFileId: string) => void;
}

/** Every round of one Look or costume, with hide and Cast (or Pick) on each image. */
export function CastingRounds(props: CastingRoundsProps) {
  return (
    <div className='flex flex-col gap-5'>
      {props.rounds.map((round) => (
        <CastingRound key={round.id} {...props} round={round} />
      ))}
    </div>
  );
}

function CastingRound({
  kind,
  subjectName,
  round,
  chosenAssetFileId,
  showHidden,
  pendingAssetFileId,
  onStatusChange,
  onChoose,
}: CastingRoundsProps & { round: CastingRoundViewResponse }) {
  // The viewer keeps the images it opened with, so hiding one never moves the shown one away.
  const [preview, setPreview] = useState<{ assetFileIds: string[]; index: number } | null>(null);
  const labels = CASTING_ROUND_KIND_LABELS[kind];
  const shown = showHidden
    ? round.candidates
    : round.candidates.filter((candidate) => isKeptCandidate(candidate, chosenAssetFileId));
  const previewCandidates = preview
    ? preview.assetFileIds.flatMap((assetFileId) => round.candidates.find((candidate) => candidate.assetFileId === assetFileId) ?? [])
    : [];
  const previewCandidate = preview ? previewCandidates[preview.index] ?? null : null;
  const toggleHidden = (candidate: CastingRoundViewResponse['candidates'][number]) =>
    onStatusChange(candidate.assetFileId, candidate.status === 'hidden' ? 'candidate' : 'hidden');
  const grid = kind === 'characterSheets' ? 'grid-cols-[repeat(auto-fill,minmax(230px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]';
  return (
    <div className='flex flex-col gap-2'>
      <p className='text-xs text-muted-foreground'>{roundSummary(round, kind)}</p>
      {shown.length > 0 ? (
        <div className={`grid gap-2.5 ${grid}`}>
          {shown.map((candidate, index) => (
            <CandidateTile
              key={candidate.assetFileId}
              kind={kind}
              imageUrl={candidate.assetFile.url}
              modelLabel={candidate.model.name}
              status={candidate.status}
              isChosen={candidate.assetFileId === chosenAssetFileId}
              disabled={pendingAssetFileId === candidate.assetFileId}
              onHide={() => toggleHidden(candidate)}
              onChoose={() => onChoose(candidate.assetFileId)}
              onOpen={() => setPreview({ assetFileIds: shown.map((entry) => entry.assetFileId), index })}
            />
          ))}
        </div>
      ) : null}
      {preview && previewCandidate ? (
        <ImagePreviewDialog
          images={previewCandidates.map((candidate) => ({
            src: candidate.assetFile.url,
            alt: `${labels.imageName} from ${candidate.model.name}`,
            title: `${subjectName} · Round ${round.number}`,
          }))}
          currentIndex={preview.index}
          onCurrentIndexChange={(index) => setPreview({ ...preview, index })}
          actions={
            <CandidatePreviewActions
              kind={kind}
              status={previewCandidate.status}
              isChosen={previewCandidate.assetFileId === chosenAssetFileId}
              disabled={pendingAssetFileId === previewCandidate.assetFileId}
              onHide={() => toggleHidden(previewCandidate)}
              onChoose={() => onChoose(previewCandidate.assetFileId)}
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
