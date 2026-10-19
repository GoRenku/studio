import { useEffect, useId, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';

const COPIED_RESET_MS = 2_000;

export function TelemetryInstallId({ installId }: { installId: string }) {
  const inputId = useId();
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
      await navigator.clipboard.writeText(installId);
      setCopyError(null);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError('Unable to copy. Select the ID and copy it manually.');
    }
  };

  return (
    <div className='space-y-2'>
      <label htmlFor={inputId} className='text-sm font-medium'>Install ID</label>
      <div className='flex items-center gap-2'>
        <Input
          id={inputId}
          readOnly
          value={installId}
          className='font-mono text-xs'
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='gap-2'
          aria-controls={inputId}
          onClick={() => void copy()}
        >
          {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {copyError ? (
        <p role='alert' className='text-xs text-destructive'>{copyError}</p>
      ) : null}
      <p className='text-sm leading-6 text-muted-foreground'>
        To have statistics already sent deleted, email support@codingventures.com
        {' '}with this ID before you turn statistics off. Turning off removes the
        ID from this computer.
      </p>
    </div>
  );
}
