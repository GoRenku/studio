import { Film } from 'lucide-react';
import { Button } from '@/ui/button';
import { ThemeToggle } from '@/ui/theme-toggle';
import { AppSettingsDialog } from '@/features/settings/app-settings-dialog';
import renkuLogo from '@/assets/renku-logo.svg';
import { StudioUpdateNotice } from './studio-update-notice';
import type { StudioUpdateController } from './use-studio-update';

interface StudioAppHeaderProps {
  update?: StudioUpdateController;
  projectTitle?: string;
  onHome?: () => void;
}

export function StudioAppHeader({
  update,
  projectTitle,
  onHome,
}: StudioAppHeaderProps) {
  return (
    <header className='rounded-(--radius-panel) border border-sidebar-border bg-sidebar-bg overflow-hidden'>
      <div className='h-14 px-4 sm:px-5 border-b border-border/40 bg-sidebar-header-bg flex items-center justify-between gap-4'>
        <Button
          type='button'
          variant='ghost'
          onClick={onHome}
          className='h-auto gap-3 rounded-md -ml-1 px-1 py-1 hover:bg-item-hover-bg/70'
          aria-label='Go to Renku Studio home'
        >
          <img
            src={renkuLogo}
            alt='Renku'
            className='h-10 w-10 rounded-md object-contain'
          />
          <span className='min-w-0 truncate text-sm font-semibold tracking-[0.02em]'>Renku Studio</span>
        </Button>

        <div className='flex min-w-0 items-center gap-2'>
          {projectTitle ? (
            <div className='hidden sm:flex min-w-0 items-center gap-2 rounded-md border border-border/40 bg-background/35 px-3 py-1.5'>
              <Film className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
              <span className='truncate text-xs font-medium text-muted-foreground'>
                {projectTitle}
              </span>
            </div>
          ) : null}
          <div className='flex items-center gap-1'>
            {update ? <StudioUpdateNotice update={update} /> : null}
            <AppSettingsDialog />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
