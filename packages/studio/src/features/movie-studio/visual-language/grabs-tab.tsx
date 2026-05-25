import { useState, type DragEvent } from 'react';
import type { InspirationFolderResource } from '@gorenku/studio-core/client';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import { FileUploadDropzone } from '@/ui/file-upload-dropzone';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { cn } from '@/lib/utils';
import { GrabCard } from './grab-card';
import { GrabGrid } from './grab-grid';
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
  const [deleteFileName, setDeleteFileName] = useState<string | null>(null);
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
          <GrabGrid>
            {images.map((image) => {
              const src = inspirationImageUrl(
                projectName,
                resource.folder.id,
                image.fileName
              );
              return (
                <GrabCard
                  key={image.fileName}
                  src={src}
                  fileName={image.fileName}
                  onOpen={() =>
                    setPreviewImage({
                      src,
                      alt: `${image.fileName} inspiration grab`,
                      title: image.fileName,
                    })
                  }
                  onDelete={() => setDeleteFileName(image.fileName)}
                />
              );
            })}
            <FileButton onFiles={(files) => void onUpload(files)} />
          </GrabGrid>
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
        image={previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteFileName)}
        onOpenChange={(open) => !open && setDeleteFileName(null)}
        title='Delete Image?'
        message='Remove this grab from the folder. This cannot be undone.'
        onDelete={async () => {
          if (!deleteFileName) return;
          await onDeleteImage(deleteFileName);
          setDeleteFileName(null);
        }}
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
