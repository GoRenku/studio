import { FolderOpen } from 'lucide-react';
import { Button } from '@/ui/button';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { StatPill } from './stat-pill';

export function GenerationActivityFooter({
  project,
}: {
  project: ProjectShellWithHttp;
}) {
  return (
    <footer className='h-20 rounded-(--radius-panel) border border-sidebar-border bg-sidebar-bg overflow-hidden shrink-0 flex items-center justify-between gap-4 px-4'>
      <div className='min-w-0'>
        <h2 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
          Generation Activity And Cost
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          No generation jobs queued. Cost tracking will attach to clip and cast
          artifacts in a later pass.
        </p>
      </div>
      <div className='hidden md:flex items-center gap-2'>
        <StatPill label='Sequences' value={project.counts.sequences} />
        <StatPill label='Scenes' value={project.counts.scenes} />
        <StatPill label='Clips' value={project.counts.clips} />
      </div>
      <Button type='button' variant='outline' disabled>
        <FolderOpen className='mr-2 h-4 w-4' />
        No Tasks
      </Button>
    </footer>
  );
}
