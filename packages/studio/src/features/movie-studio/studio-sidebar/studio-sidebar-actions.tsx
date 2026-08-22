import { ThemeToggle } from '@/ui/theme-toggle';
import { AppSettingsDialog } from '@/features/settings/app-settings-dialog';

export function StudioSidebarActions() {
  return (
    <div className='flex shrink-0 items-center gap-2'>
      <AppSettingsDialog />
      <ThemeToggle />
    </div>
  );
}
