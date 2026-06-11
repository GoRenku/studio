import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/ui/collapsible';

interface SceneShotReferenceSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SceneShotReferenceSection({
  title,
  defaultOpen = false,
  children,
}: SceneShotReferenceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const userChangedOpenState = useRef(false);

  useEffect(() => {
    if (defaultOpen && !userChangedOpenState.current) {
      setOpen(true);
    }
  }, [defaultOpen]);

  const handleOpenChange = (nextOpen: boolean) => {
    userChangedOpenState.current = true;
    setOpen(nextOpen);
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <section className='flex flex-col gap-2.5'>
        <CollapsibleTrigger asChild>
          <Button
            type='button'
            variant={null}
            size={null}
            className='flex w-full items-center justify-start gap-2 px-0 py-0 text-left hover:bg-transparent'
            aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform',
                open ? 'rotate-90' : null
              )}
            />
            <h4 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
              {title}
            </h4>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
