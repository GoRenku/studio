import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { FileUploadDropzone } from '@/ui/file-upload-dropzone';
import { characterSheetInteractiveTileClassName } from './character-sheet-generation-styles';

interface ReferenceImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (files: File[]) => void;
}

export function ReferenceImageUploadDialog({
  open,
  onOpenChange,
  onConfirm,
}: ReferenceImageUploadDialogProps) {
  const previewUrlsRef = useRef(new Set<string>());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedPreviews, setSelectedPreviews] = useState<
    Array<{ file: File; imageUrl: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      for (const objectUrl of previewUrls) {
        URL.revokeObjectURL(objectUrl);
      }
      previewUrls.clear();
    };
  }, []);

  const revokeSelectedPreviewUrls = () => {
    for (const objectUrl of previewUrlsRef.current) {
      URL.revokeObjectURL(objectUrl);
    }
    previewUrlsRef.current.clear();
  };

  const clearSelectedFiles = () => {
    revokeSelectedPreviewUrls();
    setSelectedFiles([]);
    setSelectedPreviews([]);
  };

  const updateOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearSelectedFiles();
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const selectFiles = (fileList: FileList | null) => {
    if (!fileList) {
      return;
    }

    const imageFiles = Array.from(fileList).filter((file) =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length !== fileList.length) {
      setError('Only image files can be added as character references.');
    } else {
      setError(null);
    }

    if (imageFiles.length === 0) {
      return;
    }

    const previews = imageFiles.map((file) => {
      const imageUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(imageUrl);
      return { file, imageUrl };
    });

    setSelectedFiles((currentFiles) => [...currentFiles, ...imageFiles]);
    setSelectedPreviews((currentPreviews) => [...currentPreviews, ...previews]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((_, fileIndex) => fileIndex !== index)
    );
    setSelectedPreviews((currentPreviews) => {
      const previewToRemove = currentPreviews[index];
      if (previewToRemove) {
        URL.revokeObjectURL(previewToRemove.imageUrl);
        previewUrlsRef.current.delete(previewToRemove.imageUrl);
      }

      return currentPreviews.filter((_, fileIndex) => fileIndex !== index);
    });
  };

  const uploadSelectedFiles = () => {
    if (selectedFiles.length === 0) {
      return;
    }

    setUploading(true);
    onConfirm(selectedFiles);
    setUploading(false);
    updateOpen(false);
  };

  const uploadButtonLabel =
    selectedFiles.length === 0
      ? 'Upload Images'
      : selectedFiles.length === 1
      ? 'Upload 1 Image'
      : `Upload ${selectedFiles.length} Images`;

  return (
    <Dialog open={open} onOpenChange={updateOpen}>
      <DialogContent className='max-w-2xl gap-0 overflow-hidden p-0'>
        <DialogHeader>
          <DialogTitle>Upload Reference Images</DialogTitle>
          <DialogDescription className='sr-only'>
            Upload one or more character reference images.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 px-6 py-6'>
          <FileUploadDropzone
            accept='image/*'
            multiple
            title='Drag and drop images here, or click to browse'
            description='PNG, JPG, WEBP, or GIF reference images'
            className={`focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/35 ${characterSheetInteractiveTileClassName}`}
            onFilesSelected={selectFiles}
          />

          {error ? (
            <div className='rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'>
              {error}
            </div>
          ) : null}

          {selectedPreviews.length > 0 ? (
            <div className='space-y-2'>
              <p className='text-sm text-muted-foreground'>
                Selected images ({selectedPreviews.length})
              </p>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {selectedPreviews.map((preview, index) => (
                  <div key={preview.imageUrl} className='relative'>
                    <div className='aspect-square overflow-hidden rounded-lg bg-black/50'>
                      <img
                        src={preview.imageUrl}
                        alt={preview.file.name}
                        className='h-full w-full object-cover'
                      />
                    </div>
                    <Button
                      type='button'
                      variant='destructive'
                      size='icon'
                      className='absolute -right-1.5 -top-1.5 h-6 w-6'
                      onClick={() => removeSelectedFile(index)}
                      aria-label={`Remove ${preview.file.name}`}
                    >
                      <X className='h-3.5 w-3.5' />
                    </Button>
                    <p className='mt-1 truncate text-center text-[10px] text-muted-foreground'>
                      {preview.file.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='ghost'
            onClick={() => updateOpen(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={uploadSelectedFiles}
            disabled={selectedFiles.length === 0 || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Uploading...
              </>
            ) : (
              uploadButtonLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
