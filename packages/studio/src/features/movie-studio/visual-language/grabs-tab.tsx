import type { InspirationFolderResource } from '@gorenku/studio-core/client';
import { FileUploadArea } from '@/ui/file-upload-area';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { inspirationImageUrl } from './visual-language-image-urls';

interface GrabsTabProps {
  projectName: string;
  resource: InspirationFolderResource;
  onUpload: (files: File[]) => Promise<void>;
  onDeleteImage: (fileName: string) => Promise<void>;
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
            const src = inspirationImageUrl(
              projectName,
              resource.folder.id,
              image.fileName
            );
            return (
              <MediaCard
                key={image.fileName}
                media={{
                  kind: 'image',
                  src,
                  alt: `${image.fileName} inspiration grab`,
                  fit: 'cover',
                  effect: 'zoom-on-hover',
                }}
                frame={{ kind: 'ratio', aspectRatio: 16 / 10 }}
                presentation={{ kind: 'overlay' }}
                activation={{
                  kind: 'image-preview',
                  label: `${image.fileName} inspiration grab`,
                  image: {
                    src,
                    alt: `${image.fileName} inspiration grab`,
                    title: image.fileName,
                  },
                }}
                deleteAction={{
                  label: `Delete ${image.fileName}`,
                  confirmationTitle: 'Delete Image?',
                  confirmationMessage:
                    'Remove this grab from the folder. This cannot be undone.',
                  onDelete: () => onDeleteImage(image.fileName),
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
