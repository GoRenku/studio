import { Check, UserRound } from 'lucide-react';
import { castingLookTone, CASTING_TONE_CLASS_NAMES } from '@/features/casting-views/casting-tones';
import { cn } from '@/lib/utils';
import type { CastCastingLookResponse } from '@/services/studio-project-contracts';
import { TabsList, TabsTrigger } from '@/ui/tabs';
import { lookStatus } from './casting-summaries';

/** The row of Look cards that picks which Look the tab shows: picture, name and one status each. */
export function LookPicker({ looks }: { looks: CastCastingLookResponse[] }) {
  return (
    <TabsList
      variant='line'
      aria-label='Looks'
      className='grid h-auto w-full grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 p-0 group-data-[orientation=horizontal]/tabs:h-auto'
    >
      {looks.map((look, index) => (
        <LookChoice key={look.id} look={look} toneClassName={CASTING_TONE_CLASS_NAMES[castingLookTone(index)]} />
      ))}
    </TabsList>
  );
}

function LookChoice({ look, toneClassName }: { look: CastCastingLookResponse; toneClassName: string }) {
  const status = lookStatus(look);
  return (
    <TabsTrigger
      value={look.id}
      className={cn(
        'h-auto flex-col items-stretch gap-2 whitespace-normal rounded-[10px] border border-border/40 bg-muted/30 p-2 text-left after:hidden',
        'hover:bg-muted/50 data-[state=active]:border-primary data-[state=active]:ring-1 data-[state=active]:ring-primary',
        'group-data-[variant=line]/tabs-list:data-[state=active]:bg-muted/30 dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-primary'
      )}
    >
      <span className='block aspect-[4/3] w-full overflow-hidden rounded-md bg-muted/40'>
        {look.castCandidate ? (
          <img src={look.castCandidate.url} alt={`${look.name}, cast`} className='h-full w-full object-contain' />
        ) : (
          <span className='grid h-full w-full place-items-center text-muted-foreground'>
            <UserRound aria-hidden='true' className='h-6 w-6' />
          </span>
        )}
      </span>
      <span className='flex items-start gap-1.5 text-[12.5px] font-semibold leading-snug text-foreground'>
        <span aria-hidden='true' className={cn('mt-[5px] size-2 flex-none rounded-full', toneClassName)} />
        {look.name}
      </span>
      <span className={cn('flex items-center gap-1 text-[11.5px] font-normal', status.cast ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
        {status.cast ? <Check aria-hidden='true' className='h-3 w-3' /> : null}
        {status.label}
      </span>
    </TabsTrigger>
  );
}
