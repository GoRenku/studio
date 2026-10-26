import type { CastingBoardActAction, CastingCandidateBoard } from '@gorenku/studio-codex/casting-board';
import { actOnCastingBoard, castOnCastingBoard, requestFromCastingBoard } from '@/services/codex-casting-board';
import type { BoardCandidate } from './board-summaries';
import type { CastingBoardInteraction } from './casting-board-interaction';
import { CastingRoundsBoard } from './casting-rounds-board';

/** One Look's casting rounds: hide, compare and cast candidates, or ask for more like the kept ones. */
export function CandidateBoardView(input: CastingBoardInteraction & { board: CastingCandidateBoard }) {
  const { board, interaction, media, notice } = input;
  const disabled = !interaction.connected || interaction.busy;
  const newest = board.rounds[0];

  const act = (action: CastingBoardActAction) => interaction.run(async (connected, current) => {
    interaction.applySession((await actOnCastingBoard(connected, { sessionId: current.sessionId, action })).session);
  });
  const cast = (assetFileId: string) => interaction.generate((connected, current) => castOnCastingBoard(connected, { sessionId: current.sessionId, assetFileId }));
  const requestMore = (notes: string) => interaction.generate((connected, current) => requestFromCastingBoard(connected, { sessionId: current.sessionId, request: { kind: 'moreLikeKept', notes } }));
  const toggleHidden = (candidate: BoardCandidate) => {
    void act({ kind: candidate.status === 'hidden' ? 'restore' : 'hide', assetFileId: candidate.assetFileId });
  };

  return (
    <section aria-label='Casting board' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden'>
      <CastingRoundsBoard
        kind='candidates'
        rounds={board.rounds}
        chosenAssetFileId={board.look.castAssetFileId}
        media={media}
        disabled={disabled}
        chooseDisabled={interaction.actionActive}
        emptyMessage='No casting rounds for this Look yet.'
        header={(comparing) => (
          <>
            <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
              <h1 className='m-0 text-sm font-semibold'>{comparing ? 'Compare' : 'Casting board'}</h1>
              <span className='text-xs text-[var(--dd-muted-fg)]'>{board.castMember.name} · {board.look.name}</span>
              {newest && !comparing ? <span className='ml-auto text-xs text-[var(--dd-muted-fg)]'>{newest.candidates.length} of {newest.expectedCount} in</span> : null}
            </header>
            {notice}
          </>
        )}
        onToggleHidden={toggleHidden}
        onChoose={(assetFileId) => { void cast(assetFileId); }}
        onMoreLikeKept={(notes) => { void requestMore(notes); }}
      />
    </section>
  );
}
