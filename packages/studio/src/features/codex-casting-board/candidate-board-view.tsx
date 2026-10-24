import { useState } from 'react';
import type { CastingBoardActAction, CastingBoardRound, CastingCandidateBoard } from '@gorenku/studio-codex/casting-board';
import { CandidateTile } from '@/features/casting-views/candidate-tile';
import { usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { actOnCastingBoard, castOnCastingBoard, requestFromCastingBoard } from '@/services/codex-casting-board';
import { Button } from '@/ui/button';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import { Input } from '@/ui/input';
import { Progress } from '@/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import { boardCandidates, pendingTotal, roundRoutesLine, tabCandidates, tabCounts, type BoardCandidate, type CandidateTab } from './board-summaries';
import type { CastingBoardInteraction } from './casting-board-interaction';

const PRIMARY_BUTTON = 'bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105';

export function CandidateBoardView(input: CastingBoardInteraction & { board: CastingCandidateBoard }) {
  const { board, interaction, media, notice } = input;
  const [tab, setTab] = useState<CandidateTab>('all');
  const [notes, setNotes] = useState('');
  const [comparing, setComparing] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
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

  const tileActions = (candidate: BoardCandidate) => ({
    onShortlist: () => { void act({ kind: candidate.status === 'shortlisted' ? 'restore' : 'shortlist', assetFileId: candidate.assetFileId }); },
    onHide: () => { void act({ kind: candidate.status === 'hidden' ? 'restore' : 'hide', assetFileId: candidate.assetFileId }); },
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
        ? <CompareView candidates={shortlisted} castAssetFileId={board.look.castAssetFileId} media={media} disabled={disabled || waiting} onCast={(assetFileId) => { void cast(assetFileId); }} />
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
      {preview ? <ImagePreviewDialog images={[{ src: preview.url, alt: preview.title, title: preview.title }]} currentIndex={0} onOpenChange={(open) => { if (!open) setPreview(null); }} /> : null}
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
  onOpen: (preview: { url: string; title: string }) => void;
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
        {shown.map((candidate) => (
          <BoardTile key={candidate.assetFileId} candidate={candidate} isCast={candidate.assetFileId === input.castAssetFileId} media={input.media} disabled={input.disabled} actions={input.actionsFor(candidate)} onOpen={input.onOpen} />
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
  onOpen: (preview: { url: string; title: string }) => void;
}) {
  const { url } = usePanelMediaUrl(input.media, input.candidate.imageUri);
  const title = `Round ${input.candidate.roundNumber} · ${input.candidate.model.name}`;
  return (
    <CandidateTile
      imageUrl={url}
      modelLabel={input.candidate.model.name}
      status={input.candidate.status}
      isCast={input.isCast}
      disabled={input.disabled}
      onShortlist={input.actions.onShortlist}
      onHide={input.actions.onHide}
      onOpen={url ? () => input.onOpen({ url, title }) : undefined}
    />
  );
}

function CompareView(input: { candidates: BoardCandidate[]; castAssetFileId: string | null; media: PanelMediaLibrary; disabled: boolean; onCast: (assetFileId: string) => void }) {
  return (
    <div className='grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-[18px] pb-4 pt-1 sm:grid-cols-2'>
      {input.candidates.map((candidate) => (
        <CompareFigure key={candidate.assetFileId} candidate={candidate} isCast={candidate.assetFileId === input.castAssetFileId} media={input.media} disabled={input.disabled} onCast={() => input.onCast(candidate.assetFileId)} />
      ))}
    </div>
  );
}

function CompareFigure(input: { candidate: BoardCandidate; isCast: boolean; media: PanelMediaLibrary; disabled: boolean; onCast: () => void }) {
  const { url } = usePanelMediaUrl(input.media, input.candidate.imageUri);
  return (
    <figure className='m-0 flex flex-col gap-2'>
      <CandidateTile imageUrl={url} status={input.candidate.status} isCast={input.isCast} />
      <figcaption className='flex items-center gap-2 text-[12px] text-[var(--dd-muted-fg)]'>
        <span className='flex-1'>Round {input.candidate.roundNumber} · {input.candidate.model.name}</span>
        <Button type='button' size='sm' variant={input.isCast ? 'outline' : 'default'} disabled={input.disabled || input.isCast} onClick={input.onCast} className={input.isCast ? undefined : PRIMARY_BUTTON}>
          {input.isCast ? 'Cast' : 'Cast this one'}
        </Button>
      </figcaption>
    </figure>
  );
}
