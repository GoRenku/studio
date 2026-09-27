import { ThemeToggle } from '@/ui/theme-toggle';
import { AppSettingsDialog } from '@/features/settings/app-settings-dialog';
import { StudioUpdateNotice } from '@/app/studio-update-notice';
import type { StudioUpdateController } from '@/app/use-studio-update';

export function StudioSidebarActions({ update }: { update?: StudioUpdateController }) {
  return (
    <div className='flex shrink-0 items-center gap-2'>
      <div className='flex items-center gap-1'>
        {update ? <StudioUpdateNotice update={update} /> : null}
        <AppSettingsDialog />
      </div>
      <ThemeToggle />
    </div>
  );
}
