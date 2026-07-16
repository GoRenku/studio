import type { InspirationFolderListItem } from '@gorenku/studio-core/client';
import { MediaCard } from '@/ui/media-card/media-card';
import { inspirationImageUrl } from './visual-language-image-urls';

interface InspirationFolderCardProps {
  projectName: string;
  item: InspirationFolderListItem;
  onOpen: () => void;
  onDelete: () => Promise<void>;
}

export function InspirationFolderCard({
  projectName,
  item,
  onOpen,
  onDelete,
}: InspirationFolderCardProps) {
  const imageUrl = item.cardImage
    ? inspirationImageUrl(projectName, item.folder.id, item.cardImage.fileName)
    : null;
  const imageCountLabel =
    item.imageCount === 1 ? '1 image' : `${item.imageCount} images`;

  return (
    <MediaCard
      media={
        imageUrl
          ? {
              kind: 'image',
              src: imageUrl,
              alt: `${item.folder.name} inspiration card image`,
              fit: 'cover',
              effect: 'zoom-on-hover',
            }
          : null
      }
      frame={{ kind: 'ratio', aspectRatio: 16 / 10 }}
      presentation={{
        kind: 'overlay',
        copy: {
          title: item.folder.name,
          description: imageCountLabel,
        },
      }}
      activation={{
        label: item.folder.name,
        onActivate: onOpen,
      }}
      deleteAction={{
        label: `Delete ${item.folder.name}`,
        confirmationTitle: 'Delete Folder?',
        confirmationMessage: `Remove "${item.folder.name}" and its saved grabs.`,
        onDelete,
      }}
      emptyState={{ kind: 'image' }}
    />
  );
}
