import type { InspirationFolderResource } from '@gorenku/studio-core/client';
import { FileUploadArea } from '@/ui/file-upload-area';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';

interface GrabsTabProps {
  projectName: string;
  resource: InspirationFolderResource;
  onUpload: (files: File[]) => Promise<void>;
  onDeleteImage: (assetFileId: string) => Promise<void>;
}

export function GrabsTab({
  projectName,
  resource,
  onUpload,
  onDeleteImage,
}: GrabsTabProps) {
  const images = resource.images;
  return (
    <FileUploadArea
      label='Inspiration grabs drop target'
      title='Upload images'
      accept='image/*'
      acceptsFile={(file) => file.type.startsWith('image/')}
      onUpload={onUpload}
      cardClassName='aspect-video h-auto min-h-0 border border-border/40 bg-card/35 p-0'
    >
      {(uploadCard) => (
        <MediaCardGrid minimumCardWidthPx={180}>
          {images.map((image) => {
            const src = projectAssetFileUrl(
              projectName,
              image.id
            );
            return (
              <MediaCard
                key={image.id}
                media={{
                  kind: 'image',
                  src,
                  alt: image.title ?? '',
                  fit: 'cover',
                  effect: 'zoom-on-hover',
                }}
                frame={{ kind: 'ratio', aspectRatio: 16 / 10 }}
                presentation={{ kind: 'overlay' }}
                activation={{
                  kind: 'image-preview',
                  label: 'Preview inspiration image',
                  image: {
                    src,
                    alt: image.title ?? '',
                    title: image.title ?? '',
                  },
                }}
                deleteAction={{
                  label: 'Delete inspiration image',
                  confirmationTitle: 'Delete Image?',
                  confirmationMessage:
                    'Move this grab to Trash.',
                  onDelete: () => onDeleteImage(image.id),
                }}
              />
            );
          })}
          {uploadCard}
        </MediaCardGrid>
      )}
    </FileUploadArea>
  );
}
