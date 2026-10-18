import { FolderOpen } from 'lucide-react';

export function NoMatchingProjects() {
  return (
    <div className='h-full min-h-[320px] flex items-center justify-center'>
      <div className='max-w-md rounded-xl border border-border/40 bg-card p-6 text-center shadow-lg'>
        <FolderOpen className='mx-auto h-8 w-8 text-muted-foreground' />
        <h2 className='mt-3 text-sm font-semibold'>No matching projects</h2>
        <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
          Try a different title, project name, or logline.
        </p>
      </div>
    </div>
  );
}
