import { Expand } from 'lucide-react';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { ShotDescriptionViewer } from '../shot-description-viewer';

export function PrevisDescription({ value, unavailable = false }: { value: string | null; unavailable?: boolean }) {
  const emptyMessage = unavailable ? 'Description unavailable' : 'No description';
  return (
    <section className='flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border/40 bg-sidebar-bg p-4'>
      <div className='flex h-5 items-center justify-between'>
        <h2 className='text-[11px] font-semibold uppercase tracking-widest'>Description</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='ghost' size='icon' className='size-7' aria-label='Expand Description'><Expand className='size-4' /></Button>
          </DialogTrigger>
          <DialogContent className='flex h-[min(760px,85vh)] max-w-[850px] flex-col' aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Description</DialogTitle></DialogHeader>
            <div className='min-h-0 flex-1'>
              {value === null ? <p className='p-4 text-sm text-muted-foreground'>{emptyMessage}</p> : <ShotDescriptionViewer value={value} />}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className='min-h-0 flex-1'>
        {value === null ? <p className='p-4 text-sm text-muted-foreground'>{emptyMessage}</p> : <ShotDescriptionViewer value={value} />}
      </div>
    </section>
  );
}
