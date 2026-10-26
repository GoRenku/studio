import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabsTrigger } from '@/ui/tabs';

interface CastingSubjectChoiceProps {
  /** The Tabs value: the Look or costume id, or the casting choice. */
  value: string;
  name: string;
  /** The cast picture or the picked sheet; a dashed placeholder shows `emptyLabel` without one. */
  imageUrl: string | null;
  emptyLabel: string;
  /** Short facts such as "Scene 47" or "2 sheets". */
  details: string[];
  /** "Cast" or "Picked" once the subject has its choice. */
  doneLabel: string | null;
}

/**
 * One card of a row that picks whose rounds show: the casting of a Look or one of its costumes.
 * A Tabs trigger, so the row works with arrow keys and marks the picked card.
 */
export function CastingSubjectChoice({ value, name, imageUrl, emptyLabel, details, doneLabel }: CastingSubjectChoiceProps) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'h-auto w-[214px] flex-none flex-col items-stretch gap-1.5 whitespace-normal rounded-[10px] border border-border/40 bg-muted/30 p-2 text-left after:hidden',
        'hover:bg-muted/50 data-[state=active]:border-primary data-[state=active]:ring-1 data-[state=active]:ring-primary',
        'group-data-[variant=line]/tabs-list:data-[state=active]:bg-muted/30 dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-primary'
      )}
    >
      <span aria-hidden='true' className='block aspect-video w-full overflow-hidden rounded-md bg-muted/40'>
        {imageUrl ? (
          <img src={imageUrl} alt='' className='h-full w-full object-cover' />
        ) : (
          <span className='grid h-full w-full place-items-center rounded-md border border-dashed border-border/60 text-[11px] font-normal text-muted-foreground'>
            {emptyLabel}
          </span>
        )}
      </span>
      <span className='text-[12.5px] font-semibold leading-snug text-foreground'>{name}</span>
      <span className='flex flex-wrap items-center gap-1 text-[11px] font-normal text-muted-foreground'>
        {doneLabel ? (
          <span className='inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400'>
            <Check aria-hidden='true' className='h-3 w-3' />
            {doneLabel}
          </span>
        ) : null}
        {details.map((detail, index) => (
          <span key={detail}>{doneLabel || index > 0 ? '· ' : ''}{detail}</span>
        ))}
      </span>
    </TabsTrigger>
  );
}
