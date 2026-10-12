import type { ReactNode } from 'react';
import type { ImageEditSession } from '@gorenku/studio-codex/image-edit';
import { imageTypeLabel, ownerKindLabel } from './image-type-label';

/** Header plus a stage column and a 340px direction column; columns stack below 760px. */
export function ImageEditPanelFrame(input: {
  session: ImageEditSession;
  /** `{route label} · {provider label}`, from the Skill's Route Description. */
  routeLabel: string;
  notice?: ReactNode;
  stage: ReactNode;
  direction: ReactNode;
  footer: ReactNode;
}) {
  const typeLabel = imageTypeLabel(input.session.imageType);
  return (
    <section aria-label='Image edit' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:overflow-visible'>
      <header className='flex flex-wrap items-center gap-2.5 border-b border-[var(--dd-border)] px-5 py-3'>
        <h1 className='m-0 text-sm font-semibold'>{input.session.owner.name ?? typeLabel}</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{ownerKindLabel(input.session.owner.kind)} · {typeLabel}</span>
        <span className='ml-auto text-[11.5px] font-medium text-[var(--dd-muted-fg)]'>{input.routeLabel}</span>
      </header>
      {input.notice}
      <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] max-[760px]:grid-cols-1'>
        <main className='flex min-h-0 min-w-0 flex-col bg-[var(--dd-muted)]'>{input.stage}</main>
        <aside aria-label='Edit direction' className='flex min-h-0 flex-col border-l border-[var(--dd-border)] max-[760px]:border-l-0 max-[760px]:border-t'>
          <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-5 pt-4'>{input.direction}</div>
          {input.footer}
        </aside>
      </div>
    </section>
  );
}

export function ImageEditSectionHeading(input: { children: ReactNode; count?: number }) {
  return (
    <div className='flex items-center gap-2'>
      <h2 className='m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dd-muted-fg)]'>{input.children}</h2>
      {input.count !== undefined ? <span className='ml-auto font-mono text-[11px] text-[var(--dd-muted-fg)]'>{input.count}</span> : null}
    </div>
  );
}
