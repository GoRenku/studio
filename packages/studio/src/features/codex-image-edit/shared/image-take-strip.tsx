import type { ImageEditVersion } from '@gorenku/studio-codex/image-edit';
import { usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

/** Horizontal list of the image's versions in this session: the source, then each edit in order. */
export function ImageTakeStrip(input: {
  versions: ImageEditVersion[];
  shownAssetFileId: string | null;
  generatingTakeNumber: number | null;
  media: PanelMediaLibrary;
  onShow: (assetFileId: string) => void;
}) {
  const [source, ...edits] = input.versions;
  return (
    <nav aria-label='Versions' className='flex items-center gap-1.5 overflow-x-auto border-b border-[var(--dd-border)] bg-[var(--dd-bg)] px-3 py-2'>
      {source ? <TakeItem version={source} versions={input.versions} shown={input.shownAssetFileId === source.assetFileId} media={input.media} onShow={input.onShow} /> : null}
      {edits.length > 0 || input.generatingTakeNumber !== null ? <span aria-hidden className='mx-0.5 my-1 w-px self-stretch bg-[var(--dd-border)]' /> : null}
      {edits.map((version) => <TakeItem key={version.assetFileId} version={version} versions={input.versions} shown={input.shownAssetFileId === version.assetFileId} media={input.media} onShow={input.onShow} />)}
      {input.generatingTakeNumber !== null ? (
        <div role='status' className='flex flex-none items-center gap-2 rounded-[9px] px-2.5 py-1 pl-1'>
          <span className='size-[34px] flex-none animate-pulse rounded-[5px] bg-[var(--dd-active)] motion-reduce:animate-none' />
          <span className='flex flex-col items-start gap-0.5'>
            <b className='text-xs font-semibold'>Take {input.generatingTakeNumber}</b>
            <span className='text-[10.5px] text-[var(--dd-muted-fg)]'>Generating…</span>
          </span>
        </div>
      ) : null}
    </nav>
  );
}

function TakeItem(input: { version: ImageEditVersion; versions: ImageEditVersion[]; shown: boolean; media: PanelMediaLibrary; onShow: (assetFileId: string) => void }) {
  const { url } = usePanelMediaUrl(input.media, input.version.imageUri);
  const parent = input.versions.find((version) => version.assetFileId === input.version.parentAssetFileId);
  const detail = input.version.parentAssetFileId === null && input.version === input.versions[0] ? 'Source' : parent ? `from Take ${parent.takeNumber}` : null;
  return (
    <Button
      type='button'
      variant='ghost'
      aria-current={input.shown}
      aria-label={`Take ${input.version.takeNumber}`}
      onClick={() => input.onShow(input.version.assetFileId)}
      className={cn(
        'h-auto flex-none gap-2 rounded-[9px] border border-transparent px-2.5 py-1 pl-1 text-[var(--dd-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)]',
        input.shown && 'border-[var(--dd-active-border)] bg-[var(--dd-active)] hover:bg-[var(--dd-active)]',
      )}
    >
      <span className='size-[34px] flex-none overflow-hidden rounded-[5px] bg-[var(--dd-muted)]'>
        {url ? <img alt='' src={url} className='size-full object-cover' /> : null}
      </span>
      <span className='flex flex-col items-start gap-0.5'>
        <b className='text-xs font-semibold'>Take {input.version.takeNumber}</b>
        {input.version.selected
          ? <span className='rounded-full border border-[var(--dd-sel-border)] bg-[var(--dd-sel-bg)] px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[var(--dd-sel-fg)]'>Selected</span>
          : detail ? <span className='text-[10.5px] font-normal text-[var(--dd-muted-fg)]'>{detail}</span> : null}
      </span>
    </Button>
  );
}
