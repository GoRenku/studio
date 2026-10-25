import { useState } from 'react';
import type { CastingBoardActAction, CastingBoardRound, CastingCandidateBoard } from '@gorenku/studio-codex/casting-board';
import { CandidateTile } from '@/features/casting-views/candidate-tile';
import { usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { actOnCastingBoard, castOnCastingBoard, requestFromCastingBoard } from '@/services/codex-casting-board';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Progress } from '@/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import { boardCandidates, pendingTotal, roundRoutesLine, tabCandidates, tabCounts, type BoardCandidate, type CandidateTab } from './board-summaries';
import { CandidatePreview, type CandidatePreviewSelection } from './candidate-preview';
import type { CastingBoardInteraction } from './casting-board-interaction';
import { CompareView } from './compare-view';

const STATUS_ACTIONS = { shortlisted: 'shortlist', hidden: 'hide' } as const;
const PRIMARY_BUTTON = 'bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105';

export function CandidateBoardView(input: CastingBoardInteraction & { board: CastingCandidateBoard }) {
  const { board, interaction, media, notice } = input;
  const [tab, setTab] = useState<CandidateTab>('all');
  const [notes, setNotes] = useState('');
  const [comparing, setComparing] = useState(false);
  const [preview, setPreview] = useState<CandidatePreviewSelection | null>(null);
  const candidates = boardCandidates(board);
  const shortlisted = tabCandidates(candidates, 'shortlist') as BoardCandidate[];
  const counts = tabCounts(board);
  const disabled = !interaction.connected || interaction.busy;
  const waiting = interaction.actionActive;
  const newest = board.rounds[0];

  const act = (action: CastingBoardActAction) => interaction.run(async (connected, current) => {
    interaction.applySession((await actOnCastingBoard(connected, { sessionId: current.sessionId, action })).session);
  });
  const cast = (assetFileId: string) => interaction.generate((connected, current) => castOnCastingBoard(connected, { sessionId: current.sessionId, assetFileId }));
  const requestMore = () => interaction.generate((connected, current) => requestFromCastingBoard(connected, { sessionId: current.sessionId, request: { kind: 'moreLikeShortlist', notes } }));

  const toggleStatus = (candidate: BoardCandidate, status: 'shortlisted' | 'hidden') => {
    void act({ kind: candidate.status === status ? 'restore' : STATUS_ACTIONS[status], assetFileId: candidate.assetFileId });
  };
  const tileActions = (candidate: BoardCandidate) => ({
    onShortlist: () => toggleStatus(candidate, 'shortlisted'),
    onHide: () => toggleStatus(candidate, 'hidden'),
  });

  return (
    <section aria-label='Casting board' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>{comparing ? 'Compare' : 'Casting board'}</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{board.castMember.name} · {board.look.name}{comparing ? ' · Shortlist' : ''}</span>
        {newest && !comparing ? <span className='ml-auto text-xs text-[var(--dd-muted-fg)]'>{newest.candidates.length} of {newest.expectedCount} in</span> : null}
      </header>
      {notice}
      {comparing
        ? <CompareView candidates={shortlisted} castAssetFileId={board.look.castAssetFileId} media={media} disabled={disabled} castDisabled={disabled || waiting} onCast={(assetFileId) => { void cast(assetFileId); }} onRemoveFromShortlist={(assetFileId) => { void act({ kind: 'restore', assetFileId }); }} />
        : (
          <>
            <Tabs value={tab} onValueChange={(next) => setTab(next as CandidateTab)} className='px-[18px]'>
              <TabsList variant='line'>
                <TabsTrigger value='all'>All {counts.all}</TabsTrigger>
                <TabsTrigger value='shortlist'>Shortlist {counts.shortlist}</TabsTrigger>
                <TabsTrigger value='hidden'>Hidden {counts.hidden}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pb-4 pt-3.5'>
              {board.rounds.length === 0 ? <p className='m-0 text-[12.5px] text-[var(--dd-muted-fg)]'>No casting rounds for this Look yet.</p> : null}
              {board.rounds.map((round) => (
                <RoundSection key={round.id} round={round} tab={tab} castAssetFileId={board.look.castAssetFileId} media={media} disabled={disabled} actionsFor={tileActions} onOpen={setPreview} />
              ))}
            </div>
          </>
        )}
      <footer className='flex flex-wrap items-center gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <Input aria-label='Notes for the next round' placeholder='Notes for the next round' value={notes} maxLength={2000} disabled={disabled} onChange={(event) => setNotes(event.target.value)} className='h-8 min-w-[220px] flex-1 text-[12.5px]' />
        <Button type='button' variant='outline' size='sm' disabled={disabled || (!comparing && shortlisted.length === 0)} onClick={() => setComparing(!comparing)}>
          {comparing ? 'Back to board' : `Compare ${shortlisted.length}`}
        </Button>
        <Button type='button' variant='outline' size='sm' disabled={disabled || waiting || shortlisted.length === 0} onClick={() => { void requestMore(); }}>More like the shortlist</Button>
        <Button type='button' size='sm' disabled={disabled || waiting || shortlisted.length !== 1} onClick={() => { void cast(shortlisted[0]!.assetFileId); }} className={PRIMARY_BUTTON}>Cast this Look</Button>
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
          onToggleStatus={toggleStatus}
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
  actionsFor: (candidate: BoardCandidate) => { onShortlist: () => void; onHide: () => void };
  onOpen: (selection: CandidatePreviewSelection) => void;
}) {
  const { round } = input;
  const pending = pendingTotal(round);
  const shown = tabCandidates(round.candidates, input.tab).map((candidate) => ({ ...candidate, roundNumber: round.number }));
  const pendingTiles = input.tab === 'all' ? round.pending.flatMap((entry) => Array.from({ length: entry.count }, (_, index) => ({ key: `${entry.model.key}-${index}`, label: `Generating · ${entry.model.name}` }))) : [];
  if (shown.length === 0 && pendingTiles.length === 0 && input.tab !== 'all') return null;
  return (
    <section aria-label={`Round ${round.number}`} className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-baseline gap-2.5'>
        <b className='text-[12.5px]'>Round {round.number}</b>
        <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>{roundRoutesLine(round)}</span>
      </div>
      {pending > 0 ? <Progress aria-label={`Round ${round.number} progress`} value={round.candidates.length} max={round.expectedCount} className='h-1.5' /> : null}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
        {shown.map((candidate, index) => (
          <BoardTile key={candidate.assetFileId} candidate={candidate} isCast={candidate.assetFileId === input.castAssetFileId} media={input.media} disabled={input.disabled} actions={input.actionsFor(candidate)} onOpen={() => input.onOpen({ assetFileIds: shown.map((entry) => entry.assetFileId), index })} />
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
  actions: { onShortlist: () => void; onHide: () => void };
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
      onShortlist={input.actions.onShortlist}
      onHide={input.actions.onHide}
      onOpen={url ? input.onOpen : undefined}
    />
  );
}
