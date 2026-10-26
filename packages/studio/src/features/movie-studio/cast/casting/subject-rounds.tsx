import { useState } from 'react';
import { Columns2, Eye, EyeOff } from 'lucide-react';
import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import { sceneSummary } from '@/features/casting-views/scene-labels';
import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import { AgentRequest, AgentRequestLine } from '@/ui/agent-request';
import { Button } from '@/ui/button';
import { castLookRequest, characterSheetRoundRequest, moreLikeKeptRequest, moreSheetsLikeKeptRequest } from '../../agent-request-copy';
import { CastingCompareDialog } from './casting-compare-dialog';
import { CastingRounds } from './casting-rounds';
import { hiddenCount, keptCandidates } from './casting-summaries';
import type { CastingSubject } from './casting-subjects';

/**
 * The box under the subject row: the picked Look casting's or costume's rounds, its one Compare
 * button, the hidden toggle and at most one request to the agent.
 */
export function SubjectRounds({
  castMemberName,
  lookName,
  subject,
  scenes,
  pendingAssetFileId,
  onStatusChange,
  onChoose,
}: {
  castMemberName: string;
  lookName: string;
  subject: CastingSubject;
  scenes: SceneStripScene[];
  pendingAssetFileId: string | null;
  onStatusChange: (assetFileId: string, status: CastingCandidateStatus) => void;
  onChoose: (assetFileId: string) => void;
}) {
  const [comparing, setComparing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const kept = keptCandidates(subject.rounds, subject.chosenAssetFileId);
  const hidden = hiddenCount(subject.rounds, subject.chosenAssetFileId);
  const title = subject.costume ? subject.name : lookName;
  return (
    <section aria-label={subject.costume ? subject.name : `${lookName} casting`} className='flex flex-col gap-3 rounded-[10px] border border-border/40 bg-muted/20 p-3.5'>
      <header className='flex flex-wrap items-baseline gap-3'>
        <h4 className='text-[13.5px] font-bold'>{subject.name}</h4>
        <span className='text-xs text-muted-foreground'>{sceneSummary(subject.sceneIds, scenes)}</span>
        {kept.length >= 2 ? (
          <Button type='button' variant='outline' size='sm' className='ml-auto h-7 gap-1.5 self-center text-[12px]' onClick={() => setComparing(true)}>
            <Columns2 aria-hidden='true' className='h-3.5 w-3.5' />
            Compare {kept.length}
          </Button>
        ) : null}
      </header>
      {subject.rounds.length === 0 ? (
        <div className='flex flex-col items-center gap-3 rounded-[10px] bg-muted/30 px-4 py-6'>
          <p className='text-sm font-semibold'>{subject.costume ? 'No character sheets yet' : 'No casting rounds yet'}</p>
          <AgentRequest
            request={subject.costume ? characterSheetRoundRequest(castMemberName, subject.name) : castLookRequest(castMemberName, lookName)}
            className='max-w-xl'
          />
        </div>
      ) : (
        <CastingRounds
          kind={subject.kind}
          subjectName={title}
          rounds={subject.rounds}
          chosenAssetFileId={subject.chosenAssetFileId}
          showHidden={showHidden}
          pendingAssetFileId={pendingAssetFileId}
          onStatusChange={onStatusChange}
          onChoose={onChoose}
        />
      )}
      {hidden > 0 ? (
        <Button type='button' variant='ghost' size='sm' aria-pressed={showHidden} className='h-7 gap-1.5 self-start px-2 text-[12px] text-muted-foreground' onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? <EyeOff aria-hidden='true' className='h-3.5 w-3.5' /> : <Eye aria-hidden='true' className='h-3.5 w-3.5' />}
          {showHidden ? `Fold away ${hidden} hidden` : `Show ${hidden} hidden`}
        </Button>
      ) : null}
      <FollowUp castMemberName={castMemberName} lookName={lookName} subject={subject} keptCount={kept.length} />
      <CastingCompareDialog
        kind={subject.kind}
        title={title}
        rounds={subject.rounds}
        chosenAssetFileId={subject.chosenAssetFileId}
        open={comparing}
        onOpenChange={setComparing}
        pendingAssetFileId={pendingAssetFileId}
        onChoose={onChoose}
        onHide={(assetFileId) => onStatusChange(assetFileId, 'hidden')}
      />
    </section>
  );
}

/** The quiet next step once rounds exist: another round like the kept images, until the Look is cast. */
function FollowUp({ castMemberName, lookName, subject, keptCount }: { castMemberName: string; lookName: string; subject: CastingSubject; keptCount: number }) {
  if (subject.rounds.length === 0 || keptCount === 0) return null;
  if (subject.costume) {
    return <AgentRequestLine request={moreSheetsLikeKeptRequest(castMemberName, subject.name)} />;
  }
  return subject.chosenAssetFileId ? null : <AgentRequestLine request={moreLikeKeptRequest(castMemberName, lookName)} />;
}
