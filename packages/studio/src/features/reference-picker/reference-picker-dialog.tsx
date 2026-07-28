import { MediaCardCollectionDialog } from '@/ui/media-card/media-card-collection-dialog';

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
  const items = candidates.map((candidate) => ({
    id: candidate.id,
    card: {
      media: candidate.imageUrl
        ? {
            kind: 'image' as const,
            src: candidate.imageUrl,
            alt: candidate.imageAlt,
            fit: 'cover' as const,
            effect: 'zoom-on-hover' as const,
          }
        : null,
      frame: { kind: 'ratio' as const, aspectRatio: 16 / 10 },
      presentation: {
        kind: 'overlay' as const,
        copy: candidate.title
          ? { title: candidate.title }
          : undefined,
      },
      selected: candidate.selected,
      activation: {
        kind: 'callback' as const,
        label: candidate.title ?? candidate.imageAlt,
        onActivate: () => void onChoose(candidate.id),
      },
      emptyState: { kind: 'image' as const },
    },
  }));

  return (
    <MediaCardCollectionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      state={{ kind: 'ready', items }}
      presentation={{ kind: 'inset' }}
      minimumCardWidthPx={220}
    />
  );
}
