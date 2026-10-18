import { useEffect, useId, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/ui/button';
import { Textarea } from '@/ui/textarea';

const COPIED_RESET_MS = 2_000;

export function AgentPrompt({ label, prompt }: { label: string; prompt: string }) {
  const promptId = useId();
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
      await navigator.clipboard.writeText(prompt);
      setCopyError(null);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError('Unable to copy. Select the text and copy it manually.');
    }
  };

  return (
    <div className='flex flex-col gap-2'>
      <Textarea
        id={promptId}
        aria-label={label}
        readOnly
        value={prompt}
        rows={3}
        className='resize-none bg-background/55 text-[13px] leading-relaxed'
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='gap-2'
          aria-controls={promptId}
          onClick={() => void copy()}
        >
          {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {copyError ? (
          <p role='alert' className='text-xs text-destructive'>{copyError}</p>
        ) : null}
      </div>
    </div>
  );
}
