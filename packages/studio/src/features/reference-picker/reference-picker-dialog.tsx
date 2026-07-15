import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { ImageOverlayCard } from '@/ui/image-overlay-card';

export interface ReferencePickerCandidate {
  id: string;
  title?: string;
  imageUrl: string | null;
  imageAlt: string;
  selected: boolean;
}

export function ReferencePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  candidates,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  candidates: ReferencePickerCandidate[];
  onChoose: (candidateId: string | null) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='max-h-[65vh] overflow-y-auto px-5 py-5'>
          <div className='mb-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onChoose(null)}
            >
              None
            </Button>
          </div>
          <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
            {candidates.map((candidate) => (
              <ImageOverlayCard
                key={candidate.id}
                title={candidate.title}
                imageUrl={candidate.imageUrl}
                imageAlt={candidate.imageAlt}
                selected={candidate.selected}
                onOpen={() => onChoose(candidate.id)}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
