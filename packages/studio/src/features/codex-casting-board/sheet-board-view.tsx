import type { CastingSheetBoard } from '@gorenku/studio-codex/casting-board';
import { castingSceneLabels, sceneSummary } from '@/features/casting-views/scene-labels';
import { usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { actOnCastingBoard, requestFromCastingBoard } from '@/services/codex-casting-board';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import type { CastingBoardInteraction } from './casting-board-interaction';

type SheetCostume = CastingSheetBoard['costumes'][number];
type SheetImage = CastingSheetBoard['sheets'][number];

export function SheetBoardView(input: CastingBoardInteraction & { board: CastingSheetBoard }) {
  const { board, interaction, media, notice } = input;
  const scenes = castingSceneLabels(board.scenes);
  const picked = board.costumes.filter((costume) => costume.pickedAssetFileId).length;
  const disabled = !interaction.connected || interaction.busy;
  const pick = (costumeId: string, assetFileId: string) => interaction.run(async (connected, current) => {
    interaction.applySession((await actOnCastingBoard(connected, { sessionId: current.sessionId, action: { kind: 'pickSheet', costumeId, assetFileId } })).session);
  });
  const sendPicks = () => interaction.generate((connected, current) => requestFromCastingBoard(connected, { sessionId: current.sessionId, request: { kind: 'sheetPicksDone' } }));

  return (
    <section aria-label='Character sheets' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>Character sheets</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{board.castMember.name} · {board.costumes.length} {board.costumes.length === 1 ? 'costume' : 'costumes'}</span>
        <span className='ml-auto text-xs text-[var(--dd-muted-fg)]'>{picked} of {board.costumes.length} picked</span>
      </header>
      {notice}
      <div className='flex min-h-0 flex-1 flex-col overflow-y-auto px-[18px] pb-3'>
        {board.costumes.length === 0 ? <p className='m-0 py-2 text-[12.5px] text-[var(--dd-muted-fg)]'>No costumes yet.</p> : null}
        {board.costumes.map((costume) => (
          <div key={costume.id} className='grid grid-cols-[180px_minmax(0,1fr)] items-start gap-3.5 border-t border-[var(--dd-border)] py-3 first:border-t-0'>
            <div className='flex flex-col gap-1 text-[11.5px] text-[var(--dd-muted-fg)]'>
              <h2 className='m-0 text-[12.5px] font-semibold text-[var(--dd-fg)]'>{costume.name}</h2>
              <span>{sceneSummary(costume.sceneIds, scenes)}</span>
              <LookChip board={board} costume={costume} />
            </div>
            {board.sheets.length === 0
              ? <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>No sheet yet</span>
              : (
                <div className='grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5'>
                  {board.sheets.map((sheet) => (
                    <SheetButton key={sheet.assetFileId} sheet={sheet} costume={costume} media={media} disabled={disabled} onPick={() => { void pick(costume.id, sheet.assetFileId); }} />
                  ))}
                </div>
              )}
          </div>
        ))}
      </div>
      <footer className='flex flex-wrap items-center gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <span className='min-w-0 flex-1 text-[11.5px] text-[var(--dd-muted-fg)]'>Click a sheet to pick it. Ask for another take in chat.</span>
        <Button type='button' size='sm' disabled={disabled || interaction.actionActive || board.costumes.length === 0} onClick={() => { void sendPicks(); }} className='bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105'>
          Send picks to agent
        </Button>
      </footer>
    </section>
  );
}

function LookChip(input: { board: CastingSheetBoard; costume: SheetCostume }) {
  const look = input.board.looks.find((candidate) => candidate.id === input.costume.lookId);
  if (!look) return null;
  return (
    <span className='w-fit rounded-full bg-[var(--dd-ref-bg)] px-2 py-px text-[11px] font-semibold text-[var(--dd-ref)]'>
      From: {look.name}{look.castImageUri ? ' · cast' : ''}
    </span>
  );
}

function SheetButton(input: { sheet: SheetImage; costume: SheetCostume; media: PanelMediaLibrary; disabled: boolean; onPick: () => void }) {
  const { url } = usePanelMediaUrl(input.media, input.sheet.imageUri);
  const picked = input.sheet.assetFileId === input.costume.pickedAssetFileId;
  return (
    <Button
      type='button'
      variant='ghost'
      aria-pressed={picked}
      aria-label={`${picked ? 'Picked' : 'Pick'} for ${input.costume.name}`}
      disabled={input.disabled}
      onClick={() => { if (!picked) input.onPick(); }}
      className={cn(
        'relative block aspect-[4/3] h-auto overflow-hidden rounded-lg border border-[var(--dd-border)] bg-[var(--dd-muted)] p-0 hover:bg-[var(--dd-muted)] hover:ring-2 hover:ring-[var(--dd-active-border)]',
        picked && 'ring-2 ring-[var(--dd-sel-border)]',
      )}
    >
      {url ? <img src={url} alt='' className='size-full object-contain' /> : null}
      {picked ? <span className='absolute right-1.5 top-1.5 rounded-full border border-[var(--dd-sel-border)] bg-[var(--dd-sel-bg)] px-2 py-px text-[10.5px] font-bold text-[var(--dd-sel-fg)]'>Picked</span> : null}
    </Button>
  );
}
