import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CASTING_TONE_CLASS_NAMES, type CastingLookTone } from './casting-tones';

interface LookCardProps {
  name: string;
  sceneSummary: string;
  /** The cast candidate; the card shows a quiet placeholder until the Look is cast. */
  imageUrl: string | null;
  tone: CastingLookTone;
  details: string[];
}

/** A Look at a glance: who was cast, the scenes it covers, and a few short facts. */
export function LookCard({ name, sceneSummary, imageUrl, tone, details }: LookCardProps) {
  return (
    <article className='flex min-w-[300px] flex-1 items-stretch gap-3 overflow-hidden rounded-[10px] border border-border/40 bg-muted/30 py-2.5 pr-3.5'>
      <span aria-hidden='true' className={cn('w-1 flex-none rounded-r-sm', CASTING_TONE_CLASS_NAMES[tone])} />
      <div className='aspect-[4/3] w-[120px] flex-none overflow-hidden rounded-md bg-muted/40'>
        {imageUrl ? (
          <img src={imageUrl} alt={`${name}, cast`} className='h-full w-full object-contain' />
        ) : (
          <div className='grid h-full w-full place-items-center rounded-md border border-dashed border-border/60 text-muted-foreground'>
            <UserRound aria-hidden='true' className='h-6 w-6' />
          </div>
        )}
      </div>
      <div className='flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground'>
        <h3 className='text-sm font-bold text-foreground'>{name}</h3>
        <span>{sceneSummary}</span>
        {details.map((detail) => (
          <span key={detail}>{detail}</span>
        ))}
      </div>
    </article>
  );
}
