import type { Clip } from '@gorenku/studio-core';

interface ClipDesignPanelProps {
  clip: Clip;
}

export function ClipDesignPanel({ clip }: ClipDesignPanelProps) {
  return (
    <div className='space-y-4'>
      <p className='max-w-3xl text-sm leading-relaxed text-muted-foreground'>
        {clip.summary ?? 'This clip has structure but no production assets yet.'}
      </p>
      {clip.visualIntent ? (
        <section className='max-w-3xl rounded-xl border border-border/40 bg-card shadow-lg p-4'>
          <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
            Visual Intent
          </h3>
          <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
            {clip.visualIntent}
          </p>
        </section>
      ) : null}

      <div className='grid grid-cols-1 xl:grid-cols-3 gap-3'>
        {['Design References', 'Shot Design', 'Motion Design'].map((stage) => (
          <section
            key={stage}
            className='rounded-xl border border-border/40 bg-card shadow-lg overflow-hidden'
          >
            <div className='h-[42px] border-b border-border/40 bg-muted/35 px-4 flex items-center'>
              <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
                {stage}
              </h3>
            </div>
            <div className='p-4 space-y-3'>
              <div className='aspect-video rounded-lg border border-border/40 bg-muted/40 flex items-center justify-center text-xs text-muted-foreground'>
                Empty
              </div>
              <p className='text-xs leading-relaxed text-muted-foreground'>
                Placeholder surface for future generation artifacts, simple
                prompts, enhanced prompts, model choices, and queued work.
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
