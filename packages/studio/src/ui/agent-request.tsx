import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

const COPIED_RESET_MS = 2_000;
const COPY_ERROR = 'Unable to copy. Select the text and copy it manually.';
const EDITABLE_WORDS = /(\[[^\]]+\])/;

/** A request the user copies into their agent, shown as the primary card of an empty state. */
export function AgentRequest({ request, className }: { request: string; className?: string }) {
  const { copied, copyError, copy } = useCopiedRequest(request);
  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div className='flex items-center gap-3.5 rounded-xl border border-border/60 bg-card/40 py-4 pr-4 pl-[18px] text-left'>
        <div className='min-w-0 flex-1'>
          <p className='text-[10px] font-bold uppercase tracking-[0.14em] text-primary'>
            Ask your agent
          </p>
          <p className='mt-1.5 select-text text-[15px] font-medium leading-relaxed text-foreground'>
            <RequestText request={request} />
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='gap-2'
          onClick={() => void copy()}
        >
          {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {copyError ? (
        <p role='alert' className='text-xs text-destructive'>{copyError}</p>
      ) : null}
    </div>
  );
}

/** A quieter extra request: the whole row copies it. */
export function AgentRequestLine({ request, className }: { request: string; className?: string }) {
  const { copied, copyError, copy } = useCopiedRequest(request);
  return (
    <div className={cn('flex w-full flex-col gap-1', className)}>
      <Button
        type='button'
        variant='ghost'
        className='h-auto w-full justify-between gap-3 whitespace-normal px-[18px] py-2 text-left text-[13px] font-normal text-foreground/80'
        aria-label={copied ? `Copied: ${request}` : `Copy request: ${request}`}
        onClick={() => void copy()}
      >
        <span className='min-w-0 flex-1'>
          <RequestText request={request} />
        </span>
        {copied ? (
          <Check className='h-3.5 w-3.5 flex-none text-primary' />
        ) : (
          <Copy className='h-3.5 w-3.5 flex-none text-muted-foreground' />
        )}
      </Button>
      {copyError ? (
        <p role='alert' className='px-[18px] text-xs text-destructive'>{copyError}</p>
      ) : null}
    </div>
  );
}

/** One quiet request inside a page that already has content, e.g. above empty form fields. */
export function AgentRequestHint({ request, className }: { request: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-border/60 py-1 pl-4',
        className
      )}
    >
      <span className='text-[10px] font-bold uppercase tracking-[0.14em] text-primary'>
        Ask your agent
      </span>
      <AgentRequestLine request={request} className='min-w-0 flex-1' />
    </div>
  );
}

/** Shows the request exactly as copied; bracketed words the user should edit are tinted. */
function RequestText({ request }: { request: string }) {
  return request.split(EDITABLE_WORDS).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className='text-primary'>{part}</span>
    ) : (
      part
    )
  );
}

function useCopiedRequest(request: string) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(request);
      setCopyError(null);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError(COPY_ERROR);
    }
  };

  return { copied, copyError, copy };
}
