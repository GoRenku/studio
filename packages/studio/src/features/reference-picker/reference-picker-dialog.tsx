import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';

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
  onChoose: (candidateId: string) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='max-h-[65vh] overflow-y-auto px-5 py-5'>
          <MediaCardGrid minimumCardWidthPx={220}>
            {candidates.map((candidate) => (
              <MediaCard
                key={candidate.id}
                media={
                  candidate.imageUrl
                    ? {
                        kind: 'image',
                        src: candidate.imageUrl,
                        alt: candidate.imageAlt,
                        fit: 'cover',
                        effect: 'zoom-on-hover',
                      }
                    : null
                }
                frame={{ kind: 'ratio', aspectRatio: 16 / 10 }}
                presentation={{
                  kind: 'overlay',
                  copy: candidate.title
                    ? { title: candidate.title }
                    : undefined,
                }}
                selected={candidate.selected}
                activation={{
                  label: candidate.title ?? candidate.imageAlt,
                  onActivate: () => void onChoose(candidate.id),
                }}
                emptyState={{ kind: 'image' }}
              />
            ))}
          </MediaCardGrid>
        </div>
      </DialogContent>
    </Dialog>
  );
}
