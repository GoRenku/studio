import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FileUploadDropzone } from '@/ui/file-upload-dropzone';

export function FileUploadArea({ label, title, accept, acceptsFile, onUpload, cardClassName, className, children }: {
  label: string;
  title: string;
  accept?: string;
  acceptsFile?: (file: File) => boolean;
  onUpload: (files: File[]) => Promise<void>;
  cardClassName?: string;
  className?: string;
  children: (uploadCard: ReactNode) => ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const submit = async (selected: File[]) => {
    if (busy.current) return;
    const files = acceptsFile ? selected.filter(acceptsFile) : selected;
    if (!files.length) return;
    busy.current = true;
    setUploading(true);
    setError(null);
    try {
      await onUpload(files);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Files could not be uploaded.');
    } finally {
      busy.current = false;
      setUploading(false);
    }
  };
  return (
    <div
      role='region' aria-label={label} aria-busy={uploading}
      className={cn('min-h-full border border-dashed p-4 transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-transparent', className)}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!busy.current && event.dataTransfer.types.includes('Files')) setDragging(true);
      }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = busy.current ? 'none' : 'copy'; }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void submit(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      {children(<FileUploadDropzone
        accept={accept} multiple disabled={uploading}
        title={uploading ? 'Uploading…' : title}
        className={cardClassName}
        onFilesSelected={(files) => void submit(Array.from(files ?? []))}
      />)}
      {error ? <p role='alert' className='mt-4 text-sm text-destructive'>{error}</p> : null}
    </div>
  );
}
