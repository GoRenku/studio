import { Clapperboard } from 'lucide-react';

export function SceneShotListEmpty() {
  return (
    <div className='flex flex-1 items-center justify-center bg-panel-bg p-10'>
      <div className='flex flex-col items-center text-center'>
        <span className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground'>
          <Clapperboard className='h-5 w-5' />
        </span>
        <p className='text-sm font-medium text-foreground'>No shot list yet.</p>
      </div>
    </div>
  );
}
