import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';

export function CodexPanelNotice(input: {
  error?: string;
  notificationPending: boolean;
  busy: boolean;
  onRetryNotification: () => void;
}) {
  if (!input.error && !input.notificationPending) return null;
  return (
    <div className='flex items-center gap-3 border-b border-[var(--dd-border)] px-5 py-2'>
      {input.error ? <Alert variant='destructive' className='flex-1 py-2'><AlertDescription>{input.error}</AlertDescription></Alert> : null}
      {input.notificationPending ? <Button type='button' variant='outline' size='sm' disabled={input.busy} onClick={input.onRetryNotification}>Retry notification</Button> : null}
    </div>
  );
}

/** Shown until the panel's session arrives; `themeClass` scopes the panel family's tokens. */
export function CodexPanelPending(input: { error?: string; label: string; themeClass: string }) {
  return (
    <section className={`${input.themeClass} flex h-screen items-center justify-center p-6`}>
      {input.error
        ? <Alert variant='destructive' className='max-w-lg'><AlertDescription>{input.error}</AlertDescription></Alert>
        : <p role='status' className='text-sm text-[var(--dd-muted-fg)]'>Opening {input.label}…</p>}
    </section>
  );
}

export function CodexPanelGenerateButton(input: { generating: boolean; disabled: boolean; onGenerate: () => void }) {
  return (
    <Button type='button' className='ml-auto h-auto rounded-lg border border-transparent bg-[var(--dd-primary)] px-[18px] py-[9px] text-[12.5px] font-semibold text-[var(--dd-primary-fg)] shadow-none hover:bg-[var(--dd-primary)] hover:brightness-105 disabled:opacity-55' disabled={input.disabled || input.generating} onClick={input.onGenerate}>
      {input.generating ? 'Generating…' : 'Generate'}
    </Button>
  );
}
