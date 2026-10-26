import { useState } from 'react';
import type { CastingBoardActAction, CastingBoardRound, CastingCandidateBoard } from '@gorenku/studio-codex/casting-board';
import { CandidateTile } from '@/features/casting-views/candidate-tile';
import { CompareView } from '@/features/casting-views/compare-view';
import { usePanelMediaUrl, usePanelMediaUrls, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { actOnCastingBoard, castOnCastingBoard, requestFromCastingBoard } from '@/services/codex-casting-board';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Progress } from '@/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import { boardCandidates, pendingTotal, roundRoutesLine, tabCandidates, tabCounts, type BoardCandidate, type CandidateTab } from './board-summaries';
import { CandidatePreview, type CandidatePreviewSelection } from './candidate-preview';
import type { CastingBoardInteraction } from './casting-board-interaction';

const PRIMARY_BUTTON = 'bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105';

export function CandidateBoardView(input: CastingBoardInteraction & { board: CastingCandidateBoard }) {
  const { board, interaction, media, notice } = input;
  const [tab, setTab] = useState<CandidateTab>('candidates');
  const [notes, setNotes] = useState('');
  const [comparing, setComparing] = useState(false);
  const [preview, setPreview] = useState<CandidatePreviewSelection | null>(null);
  const candidates = boardCandidates(board);
  const kept = tabCandidates(candidates, 'candidates', board.look.castAssetFileId);
  const keptUrls = usePanelMediaUrls(media, kept.map((candidate) => candidate.imageUri));
  const counts = tabCounts(board);
  const disabled = !interaction.connected || interaction.busy;
  const waiting = interaction.actionActive;
  const newest = board.rounds[0];

  const act = (action: CastingBoardActAction) => interaction.run(async (connected, current) => {
    interaction.applySession((await actOnCastingBoard(connected, { sessionId: current.sessionId, action })).session);
  });
  const cast = (assetFileId: string) => interaction.generate((connected, current) => castOnCastingBoard(connected, { sessionId: current.sessionId, assetFileId }));
  const requestMore = () => interaction.generate((connected, current) => requestFromCastingBoard(connected, { sessionId: current.sessionId, request: { kind: 'moreLikeKept', notes } }));

  const toggleHidden = (candidate: BoardCandidate) => {
    void act({ kind: candidate.status === 'hidden' ? 'restore' : 'hide', assetFileId: candidate.assetFileId });
  };
  const showCompare = comparing && kept.length >= 2;

  return (
    <section aria-label='Casting board' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>{showCompare ? 'Compare' : 'Casting board'}</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{board.castMember.name} · {board.look.name}</span>
        {newest && !showCompare ? <span className='ml-auto text-xs text-[var(--dd-muted-fg)]'>{newest.candidates.length} of {newest.expectedCount} in</span> : null}
      </header>
      {notice}
      {showCompare
        ? <CompareView candidates={kept.map((candidate) => ({ assetFileId: candidate.assetFileId, imageUrl: keptUrls.get(candidate.imageUri), label: `Round ${candidate.roundNumber} · ${candidate.model.name}` }))} castAssetFileId={board.look.castAssetFileId} disabled={disabled} castDisabled={disabled || waiting} onCast={(assetFileId) => { void cast(assetFileId); }} onHide={(assetFileId) => { void act({ kind: 'hide', assetFileId }); }} />
        : (
          <>
            <Tabs value={tab} onValueChange={(next) => setTab(next as CandidateTab)} className='px-[18px]'>
              <TabsList variant='line'>
                <TabsTrigger value='candidates'>Candidates {counts.candidates}</TabsTrigger>
                <TabsTrigger value='hidden'>Hidden {counts.hidden}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pb-4 pt-3.5'>
              {board.rounds.length === 0 ? <p className='m-0 text-[12.5px] text-[var(--dd-muted-fg)]'>No casting rounds for this Look yet.</p> : null}
              {board.rounds.map((round) => (
                <RoundSection key={round.id} round={round} tab={tab} castAssetFileId={board.look.castAssetFileId} media={media} disabled={disabled} onToggleHidden={toggleHidden} onCast={(candidate) => { void cast(candidate.assetFileId); }} onOpen={setPreview} />
              ))}
            </div>
          </>
        )}
      <footer className='flex flex-wrap items-center gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <Input aria-label='Notes for the next round' placeholder='Notes for the next round' value={notes} maxLength={2000} disabled={disabled} onChange={(event) => setNotes(event.target.value)} className='h-8 min-w-[220px] flex-1 text-[12.5px]' />
        <Button type='button' variant='outline' size='sm' disabled={disabled || (!showCompare && kept.length < 2)} onClick={() => setComparing(!showCompare)}>
          {showCompare ? 'Back to board' : `Compare ${kept.length}`}
        </Button>
        <Button type='button' size='sm' disabled={disabled || waiting || kept.length === 0} onClick={() => { void requestMore(); }} className={PRIMARY_BUTTON}>More like these</Button>
      </footer>
      {preview ? (
        <CandidatePreview
          selection={preview}
          candidates={candidates}
          castAssetFileId={board.look.castAssetFileId}
          media={media}
          disabled={disabled}
          castDisabled={waiting}
          onSelectionChange={setPreview}
          onToggleHidden={toggleHidden}
          onCast={(assetFileId) => { void cast(assetFileId); }}
        />
      ) : null}
    </section>
  );
}

function RoundSection(input: {
  round: CastingBoardRound;
  tab: CandidateTab;
  castAssetFileId: string | null;
  media: PanelMediaLibrary;
  disabled: boolean;
  onToggleHidden: (candidate: BoardCandidate) => void;
  onCast: (candidate: BoardCandidate) => void;
  onOpen: (selection: CandidatePreviewSelection) => void;
}) {
  const { round } = input;
  const pending = pendingTotal(round);
  const shown = tabCandidates(round.candidates, input.tab, input.castAssetFileId).map((candidate) => ({ ...candidate, roundNumber: round.number }));
  const pendingTiles = input.tab === 'candidates' ? round.pending.flatMap((entry) => Array.from({ length: entry.count }, (_, index) => ({ key: `${entry.model.key}-${index}`, label: `Generating · ${entry.model.name}` }))) : [];
  if (shown.length === 0 && pendingTiles.length === 0 && input.tab !== 'candidates') return null;
  return (
    <section aria-label={`Round ${round.number}`} className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-baseline gap-2.5'>
        <b className='text-[12.5px]'>Round {round.number}</b>
        <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>{roundRoutesLine(round)}</span>
      </div>
      {pending > 0 ? <Progress aria-label={`Round ${round.number} progress`} value={round.candidates.length} max={round.expectedCount} className='h-1.5' /> : null}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
        {shown.map((candidate, index) => (
          <BoardTile key={candidate.assetFileId} candidate={candidate} isCast={candidate.assetFileId === input.castAssetFileId} media={input.media} disabled={input.disabled} onHide={() => input.onToggleHidden(candidate)} onCast={() => input.onCast(candidate)} onOpen={() => input.onOpen({ assetFileIds: shown.map((entry) => entry.assetFileId), index })} />
        ))}
        {pendingTiles.map((tile) => <CandidateTile key={tile.key} status='candidate' isCast={false} pending={{ label: tile.label }} />)}
      </div>
    </section>
  );
}

function BoardTile(input: {
  candidate: BoardCandidate;
  isCast: boolean;
  media: PanelMediaLibrary;
  disabled: boolean;
  onHide: () => void;
  onCast: () => void;
  onOpen: () => void;
}) {
  const { url } = usePanelMediaUrl(input.media, input.candidate.imageUri);
  return (
    <CandidateTile
      imageUrl={url}
      modelLabel={input.candidate.model.name}
      status={input.candidate.status}
      isCast={input.isCast}
      disabled={input.disabled}
      onHide={input.onHide}
      onCast={input.onCast}
      onOpen={url ? input.onOpen : undefined}
    />
  );
}
