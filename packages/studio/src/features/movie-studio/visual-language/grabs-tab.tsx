import { useState, type DragEvent } from 'react';
import type { InspirationFolderResource } from '@gorenku/studio-core/client';
import { FileUploadDropzone } from '@/ui/file-upload-dropzone';
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
          {images.map((image) => (
            <GrabCard
              key={image.fileName}
              src={inspirationImageUrl(projectName, resource.folder.id, image.fileName)}
              fileName={image.fileName}
              onDelete={() => void onDeleteImage(image.fileName)}
            />
          ))}
          <FileButton onFiles={(files) => void onUpload(files)} />
        </GrabGrid>
      ) : (
        <FileUploadDropzone
          accept='image/*'
          multiple
          title='Drop grabs here or upload images.'
          description='Select one or more reference images.'
          onFilesSelected={(files) => void onUpload(Array.from(files ?? []))}
        />
      )}
    </div>
  );
}

function FileButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  return (
    <FileUploadDropzone
      accept='image/*'
      multiple
      title='Upload images'
      description='Multiple files accepted.'
      className='aspect-video h-auto min-h-0 border border-border/40 p-3 text-left'
      onFilesSelected={(files) => onFiles(Array.from(files ?? []))}
    />
  );
}
