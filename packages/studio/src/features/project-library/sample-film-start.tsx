import { Film, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Progress } from '@/ui/progress';
import { cn } from '@/lib/utils';
import type { SampleFilmStartView } from './use-sample-film-installation';

const MEGABYTE = 1_000_000;

export interface SampleFilmStartController {
  view: SampleFilmStartView;
  isStarting: boolean;
  start: () => Promise<void>;
}

const SAMPLE_FILM_TITLE = 'Explore the sample film';

/** The sample film start as the leading card of an empty Library. */
export function SampleFilmLeadStart({ controller }: { controller: SampleFilmStartController }) {
  return (
    <section className='grid grid-cols-[1fr_280px] items-center gap-6 rounded-xl border border-border/40 bg-card p-7 shadow-lg'>
      <div className='flex items-start gap-4'>
        <SampleFilmIcon />
        <div className='flex flex-col gap-2'>
          <h3 className='text-[17px] font-semibold'>{SAMPLE_FILM_TITLE}</h3>
          <p className='text-[13px] leading-relaxed text-muted-foreground'>
            Basilica, a short film taken from screenplay to storyboards, shot plans and video in
            Renku. Browse everything; no API keys needed.
          </p>
        </div>
      </div>
      <SampleFilmAction controller={controller} size='default' align='center' />
    </section>
  );
}

/** The sample film start as a tile at the end of a Library that has projects. */
export function SampleFilmTileStart({ controller }: { controller: SampleFilmStartController }) {
  return (
    <section className='flex flex-col gap-2.5 rounded-xl border border-dashed border-primary/55 bg-primary/5 p-[18px]'>
      <SampleFilmIcon />
      <h3 className='text-sm font-semibold'>{SAMPLE_FILM_TITLE}</h3>
      <p className='text-xs leading-relaxed text-muted-foreground'>
        Basilica, taken from screenplay to video in Renku. No API keys needed.
      </p>
      <div className='mt-auto'>
        <SampleFilmAction controller={controller} size='sm' align='start' />
      </div>
    </section>
  );
}

function SampleFilmIcon() {
  return (
    <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary'>
      <Film className='h-[18px] w-[18px]' />
    </div>
  );
}

function SampleFilmAction({
  controller,
  size,
  align,
}: {
  controller: SampleFilmStartController;
  size: 'default' | 'sm';
  align: 'center' | 'start';
}) {
  const { view, isStarting, start } = controller;
  const hintClassName = cn('text-xs text-muted-foreground', align === 'center' && 'text-center');
  const busy = isStarting || view.state === 'loading' || view.state === 'downloading' || view.state === 'preparing';
  const button = (
    <Button type='button' size={size} disabled={busy} onClick={() => void start()}>
      {view.state === 'failed' ? 'Try again' : 'Open the sample film'}
    </Button>
  );

  switch (view.state) {
    case 'downloading':
      return (
        <div className='flex flex-col gap-2.5'>
          {view.archiveBytes !== null ? (
            <Progress
              value={view.receivedBytes}
              max={view.archiveBytes}
              aria-label='Sample film download'
            />
          ) : null}
          <p className={hintClassName}>
            {view.archiveBytes === null
              ? `Downloading ${formatMegabytes(view.receivedBytes)} MB`
              : `Downloading ${formatMegabytes(view.receivedBytes)} of ${formatMegabytes(view.archiveBytes)} MB`}
          </p>
          {button}
        </div>
      );
    case 'preparing':
      return (
        <div className='flex flex-col gap-2.5'>
          <p className={cn('flex items-center gap-2 text-[13px] text-muted-foreground', align === 'center' && 'justify-center')}>
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
            Preparing the sample film…
          </p>
          {button}
        </div>
      );
    case 'failed':
      return (
        <div className='flex flex-col gap-2.5'>
          <Alert variant='destructive'>
            <AlertTitle className='line-clamp-none [overflow-wrap:anywhere]'>{view.error.message}</AlertTitle>
            {view.error.suggestion ? (
              <AlertDescription>{view.error.suggestion}</AlertDescription>
            ) : null}
          </Alert>
          {button}
        </div>
      );
    default:
      return (
        <div className='flex flex-col gap-2.5'>
          {button}
          {view.state === 'ready' ? (
            <p className={hintClassName}>
              {view.archiveBytes === null
                ? 'Downloads from GitHub.'
                : `Downloads about ${formatMegabytes(view.archiveBytes)} MB from GitHub.`}
            </p>
          ) : null}
        </div>
      );
  }
}

function formatMegabytes(bytes: number): number {
  return Math.round(bytes / MEGABYTE);
}
