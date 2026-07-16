import { useState, type DragEvent } from 'react';
import type { InspirationFolderResource } from '@gorenku/studio-core/client';
import { FileUploadDropzone } from '@/ui/file-upload-dropzone';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { cn } from '@/lib/utils';
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
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const uploadDroppedFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    );
    if (files.length) {
      void onUpload(files);
    }
  };

  return (
    <>
      <div
        role='region'
        aria-label='Inspiration grabs drop target'
        className={cn(
          'min-h-full border border-dashed p-4 transition-colors',
          draggingFiles
            ? 'border-primary bg-primary/5'
            : 'border-transparent bg-transparent'
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (event.dataTransfer.types.includes('Files')) {
            setDraggingFiles(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDraggingFiles(false);
          }
        }}
        onDrop={uploadDroppedFiles}
      >
        {images.length ? (
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
                    label: `${image.fileName} inspiration grab`,
                    onActivate: () =>
                      setPreviewImage({
                        src,
                        alt: `${image.fileName} inspiration grab`,
                        title: image.fileName,
                      }),
                  }}
                  deleteAction={{
                    label: `Delete ${image.fileName}`,
                    confirmationTitle: 'Delete Image?',
                    confirmationMessage:
                      'Remove this grab from the folder. This cannot be undone.',
                    onDelete: async () => {
                      await onDeleteImage(image.fileName);
                      setPreviewImage((current) =>
                        current?.src === src ? null : current
                      );
                    },
                  }}
                />
              );
            })}
            <FileButton onFiles={(files) => void onUpload(files)} />
          </MediaCardGrid>
        ) : (
          <FileUploadDropzone
            accept='image/*'
            multiple
            title='Drop grabs here or upload images.'
            description='Reference frames for this inspiration folder.'
            onFilesSelected={(files) => void onUpload(Array.from(files ?? []))}
          />
        )}
      </div>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
  );
}

function FileButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  return (
    <FileUploadDropzone
      accept='image/*'
      multiple
      title='Upload images'
      className='aspect-video h-auto min-h-0 border border-border/40 bg-card/35 p-0'
      onFilesSelected={(files) => onFiles(Array.from(files ?? []))}
    />
  );
}
