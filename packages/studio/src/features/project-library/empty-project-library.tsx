import { FolderOpen } from 'lucide-react';

export function EmptyProjectLibrary({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className='h-full min-h-[320px] flex items-center justify-center'>
      <div className='max-w-md rounded-xl border border-border/40 bg-card p-6 text-center shadow-lg'>
        <FolderOpen className='mx-auto h-8 w-8 text-muted-foreground' />
        <h2 className='mt-3 text-sm font-semibold'>
          {hasQuery ? 'No matching projects' : 'No projects found'}
        </h2>
        <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
          {hasQuery
            ? 'Try a different title, project name, or logline.'
            : 'Create an empty Project to initialize its database, then use the agent to import an FDX or develop a screenplay.'}
        </p>
      </div>
    </div>
  );
}
