import { Loader2 } from 'lucide-react';
import { Button } from '@/ui/button';
import type { SceneDialogueAudioEstimateState } from './use-scene-dialogue-audio';

interface SceneDialogueAudioFooterProps {
  approvalToken: string | null;
  blocked: boolean;
  busy: boolean;
  estimate: SceneDialogueAudioEstimateState;
  onGenerate: () => void;
}

export function SceneDialogueAudioFooter({
  approvalToken,
  blocked,
  busy,
  estimate,
  onGenerate,
}: SceneDialogueAudioFooterProps) {
  const canGenerate = !blocked && !busy && Boolean(approvalToken);
  return (
    <footer className='flex shrink-0 items-center justify-between gap-2 border-t border-border/40 bg-sidebar-header-bg/70 px-4 py-3'>
      <div className='flex h-8 min-w-0 flex-1 items-center justify-between gap-3 rounded-md border border-border/50 bg-panel-header-bg px-3'>
        <span className='shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Estimate
        </span>
        <span className='min-w-0 truncate font-mono text-sm leading-none text-foreground'>
          {estimate.label}
        </span>
      </div>
      <Button
        type='button'
        size='sm'
        disabled={!canGenerate}
        onClick={onGenerate}
        className='shrink-0 gap-2 bg-primary text-white hover:bg-primary/90'
      >
        {busy ? (
          <Loader2 data-icon='inline-start' className='animate-spin' aria-hidden />
        ) : null}
        {busy ? 'Generating' : 'Generate'}
      </Button>
    </footer>
  );
}
