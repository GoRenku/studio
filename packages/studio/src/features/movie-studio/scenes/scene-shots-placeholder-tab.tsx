import { Plus } from 'lucide-react';
import { Button } from '@/ui/button';

export function SceneShotsPlaceholderTab() {
  return (
    <div className='min-h-0 min-w-0 flex-1 overflow-y-auto bg-panel-bg p-4'>
      <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
        <Button
          type='button'
          variant='outline'
          className='aspect-video h-auto min-w-0 flex-col gap-2 rounded-md border-dashed bg-muted/20'
        >
          <Plus className='h-5 w-5' />
          <span className='text-sm font-medium'>New Shot</span>
        </Button>
      </div>
    </div>
  );
}
