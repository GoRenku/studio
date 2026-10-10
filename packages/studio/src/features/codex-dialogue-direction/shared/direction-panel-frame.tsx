import type { ReactNode } from 'react';
import type { DialogueDirectionSession } from '@gorenku/studio-codex/dialogue-direction';
import { Button } from '@/ui/button';

export function DirectionPanelFrame(input: {
  shotPlan: DialogueDirectionSession['shotPlan'];
  modelLabel: string;
  allLinesSelected: boolean;
  onSelectAll: () => void;
  rail: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={`${input.modelLabel} dialogue direction`} className='dialogue-direction flex h-screen min-h-0 flex-col overflow-hidden max-[860px]:h-auto max-[860px]:min-h-screen max-[860px]:overflow-visible'>
      <header className='flex items-center gap-2.5 border-b border-[var(--dd-border)] px-5 py-3'>
        <h1 className='m-0 text-sm font-semibold'>{input.shotPlan.title}</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{input.shotPlan.sceneHeading}</span>
        <span className='ml-auto text-[11.5px] font-medium text-[var(--dd-muted-fg)]'>{input.modelLabel}</span>
        <Button
          type='button'
          variant='ghost'
          className='ml-3.5 h-auto rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)] px-3 py-[5px] text-xs font-medium text-[var(--dd-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)] disabled:opacity-55'
          disabled={input.allLinesSelected}
          onClick={input.onSelectAll}
        >
          Select all
        </Button>
      </header>
      {input.notice}
      <div className='grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] max-[860px]:grid-cols-1 max-[860px]:content-start'>
        {input.rail}
        <main className='flex min-w-0 flex-col gap-[18px] overflow-y-auto px-7 pb-[30px] pt-[22px] max-[860px]:overflow-visible'>{input.children}</main>
      </div>
    </section>
  );
}
