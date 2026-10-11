import { CodexPanelGenerateButton } from '@/features/codex-panels/codex-panel-notice';
import { cn } from '@/lib/utils';

/** Explains why Generate is unavailable, or what the next edit starts from. */
export function ImageEditGenerateBar(input: {
  message: string;
  /** What one Generate click authorizes: the upload, the provider and the paid run. */
  disclosure: string;
  problem: boolean;
  generating: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className='flex flex-col gap-2 border-t border-[var(--dd-border)] bg-[var(--dd-bg)] px-4 py-3'>
      <div className='flex items-center gap-2.5'>
        <span role='status' className={cn('min-w-0 flex-1 text-[11.5px] text-[var(--dd-muted-fg)]', input.problem && 'text-[var(--dd-destructive)]')}>{input.message}</span>
        <CodexPanelGenerateButton generating={input.generating} disabled={input.disabled} onGenerate={input.onGenerate} />
      </div>
      <p className='m-0 text-[11px] leading-snug text-[var(--dd-muted-fg)]'>{input.disclosure}</p>
    </div>
  );
}
