import { useState, type ReactNode } from 'react';
import type { CastingRoundKind } from '@gorenku/studio-core/client';
import type { CastingBoardRound } from '@gorenku/studio-codex/casting-board';
import { CandidateTile } from '@/features/casting-views/candidate-tile';
import { CompareView } from '@/features/casting-views/compare-view';
import { CASTING_ROUND_KIND_LABELS } from '@/features/casting-views/round-kind-labels';
import { usePanelMediaUrl, usePanelMediaUrls, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Progress } from '@/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs';
import { boardCandidates, pendingTotal, roundRoutesLine, tabCandidates, tabCounts, type BoardCandidate, type CandidateTab } from './board-summaries';
import { CandidatePreview, type CandidatePreviewSelection } from './candidate-preview';

const PRIMARY_BUTTON = 'bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105';

/**
 * The rounds of one Look or costume on the casting board: kept and hidden tabs, round tiles, the
 * image viewer, Compare and the footer with notes and "More like these". Faces are cast, sheets are
 * picked; the caller saves each step.
 */
export function CastingRoundsBoard(input: {
  kind: CastingRoundKind;
  rounds: CastingBoardRound[];
  chosenAssetFileId: string | null;
  media: PanelMediaLibrary;
  disabled: boolean;
  /** Choosing is held back while a request waits for the agent. */
  chooseDisabled: boolean;
  /** The view's title row; it reads "Compare" while comparing. */
  header: (comparing: boolean) => ReactNode;
  /** Shown above the tabs, such as the costume picker. */
  above?: ReactNode;
  emptyMessage: string;
  onToggleHidden: (candidate: BoardCandidate) => void;
  onChoose: (assetFileId: string) => void;
  onMoreLikeKept: (notes: string) => void;
}) {
  const { kind, rounds, chosenAssetFileId, media } = input;
  const labels = CASTING_ROUND_KIND_LABELS[kind];
  const [tab, setTab] = useState<CandidateTab>('kept');
  const [notes, setNotes] = useState('');
  const [comparing, setComparing] = useState(false);
  const [preview, setPreview] = useState<CandidatePreviewSelection | null>(null);
  const candidates = boardCandidates(rounds);
  const kept = tabCandidates(candidates, 'kept', chosenAssetFileId);
  const keptUrls = usePanelMediaUrls(media, kept.map((candidate) => candidate.imageUri));
  const counts = tabCounts(rounds, chosenAssetFileId);
  const showCompare = comparing && kept.length >= 2;

  return (
    <>
      {input.header(showCompare)}
      {showCompare ? (
        <CompareView
          kind={kind}
          candidates={kept.map((candidate) => ({ assetFileId: candidate.assetFileId, imageUrl: keptUrls.get(candidate.imageUri), label: `Round ${candidate.roundNumber} · ${candidate.model.name}` }))}
          chosenAssetFileId={chosenAssetFileId}
          disabled={input.disabled}
          chooseDisabled={input.disabled || input.chooseDisabled}
          onChoose={input.onChoose}
          onHide={(assetFileId) => {
            const candidate = candidates.find((entry) => entry.assetFileId === assetFileId);
            if (candidate) input.onToggleHidden(candidate);
          }}
        />
      ) : (
        <>
          {input.above}
          <Tabs value={tab} onValueChange={(next) => setTab(next as CandidateTab)} className='px-[18px]'>
            <TabsList variant='line'>
              <TabsTrigger value='kept'>{capitalize(labels.noun)}s {counts.kept}</TabsTrigger>
              <TabsTrigger value='hidden'>Hidden {counts.hidden}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pb-4 pt-3.5'>
            {rounds.length === 0 ? <p className='m-0 text-[12.5px] text-[var(--dd-muted-fg)]'>{input.emptyMessage}</p> : null}
            {rounds.map((round) => (
              <RoundSection key={round.id} kind={kind} round={round} tab={tab} chosenAssetFileId={chosenAssetFileId} media={media} disabled={input.disabled} onToggleHidden={input.onToggleHidden} onChoose={input.onChoose} onOpen={setPreview} />
            ))}
          </div>
        </>
      )}
      <footer className='flex flex-wrap items-center gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <Input aria-label='Notes for the next round' placeholder='Notes for the next round' value={notes} maxLength={2000} disabled={input.disabled} onChange={(event) => setNotes(event.target.value)} className='h-8 min-w-[220px] flex-1 text-[12.5px]' />
        <Button type='button' variant='outline' size='sm' disabled={input.disabled || (!showCompare && kept.length < 2)} onClick={() => setComparing(!showCompare)}>
          {showCompare ? 'Back to board' : `Compare ${kept.length}`}
        </Button>
        <Button type='button' size='sm' disabled={input.disabled || input.chooseDisabled || kept.length === 0} onClick={() => input.onMoreLikeKept(notes)} className={PRIMARY_BUTTON}>More like these</Button>
      </footer>
      {preview ? (
        <CandidatePreview
          kind={kind}
          selection={preview}
          candidates={candidates}
          chosenAssetFileId={chosenAssetFileId}
          media={media}
          disabled={input.disabled}
          chooseDisabled={input.chooseDisabled}
          onSelectionChange={setPreview}
          onToggleHidden={input.onToggleHidden}
          onChoose={input.onChoose}
        />
      ) : null}
    </>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function RoundSection(input: {
  kind: CastingRoundKind;
  round: CastingBoardRound;
  tab: CandidateTab;
  chosenAssetFileId: string | null;
  media: PanelMediaLibrary;
  disabled: boolean;
  onToggleHidden: (candidate: BoardCandidate) => void;
  onChoose: (assetFileId: string) => void;
  onOpen: (selection: CandidatePreviewSelection) => void;
}) {
  const { round } = input;
  const pending = pendingTotal(round);
  const shown = tabCandidates(round.candidates, input.tab, input.chosenAssetFileId).map((candidate) => ({ ...candidate, roundNumber: round.number }));
  const pendingTiles = input.tab === 'kept' ? round.pending.flatMap((entry) => Array.from({ length: entry.count }, (_, index) => ({ key: `${entry.model.key}-${index}`, label: `Generating · ${entry.model.name}` }))) : [];
  if (shown.length === 0 && pendingTiles.length === 0 && input.tab !== 'kept') return null;
  const grid = input.kind === 'characterSheets' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  return (
    <section aria-label={`Round ${round.number}`} className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-baseline gap-2.5'>
        <b className='text-[12.5px]'>Round {round.number}</b>
        <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>{roundRoutesLine(round)}</span>
      </div>
      {pending > 0 ? <Progress aria-label={`Round ${round.number} progress`} value={round.candidates.length} max={round.expectedCount} className='h-1.5' /> : null}
      <div className={`grid gap-2 ${grid}`}>
        {shown.map((candidate, index) => (
          <BoardTile key={candidate.assetFileId} kind={input.kind} candidate={candidate} isChosen={candidate.assetFileId === input.chosenAssetFileId} media={input.media} disabled={input.disabled} onHide={() => input.onToggleHidden(candidate)} onChoose={() => input.onChoose(candidate.assetFileId)} onOpen={() => input.onOpen({ assetFileIds: shown.map((entry) => entry.assetFileId), index })} />
        ))}
        {pendingTiles.map((tile) => <CandidateTile key={tile.key} kind={input.kind} status='candidate' isChosen={false} pending={{ label: tile.label }} />)}
      </div>
    </section>
  );
}

function BoardTile(input: {
  kind: CastingRoundKind;
  candidate: BoardCandidate;
  isChosen: boolean;
  media: PanelMediaLibrary;
  disabled: boolean;
  onHide: () => void;
  onChoose: () => void;
  onOpen: () => void;
}) {
  const { url } = usePanelMediaUrl(input.media, input.candidate.imageUri);
  return (
    <CandidateTile
      kind={input.kind}
      imageUrl={url}
      modelLabel={input.candidate.model.name}
      status={input.candidate.status}
      isChosen={input.isChosen}
      disabled={input.disabled}
      onHide={input.onHide}
      onChoose={input.onChoose}
      onOpen={url ? input.onOpen : undefined}
    />
  );
}
