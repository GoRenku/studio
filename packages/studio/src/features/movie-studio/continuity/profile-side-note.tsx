import { cn } from '@/lib/utils';

export function ProfileSideNote({
  label,
  text,
  className,
}: {
  label: string;
  text: string | undefined;
  className?: string;
}) {
  if (!text) {
    return null;
  }
  return (
    <aside
      className={cn(
        'rounded-[10px] border border-border/40 bg-muted/30 px-[18px] py-4',
        className
      )}
    >
      <h2 className='text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground'>
        {label}
      </h2>
      <p className='mt-2 whitespace-pre-line text-[13.5px] leading-[1.65] text-foreground/80'>
        {text}
      </p>
    </aside>
  );
}
