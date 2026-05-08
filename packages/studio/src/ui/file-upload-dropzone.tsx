import * as React from 'react';
import { CloudUpload } from 'lucide-react';
import { Input } from '@/ui/input';
import { cn } from '@/lib/utils';

interface FileUploadDropzoneProps {
  accept?: string;
  multiple?: boolean;
  title: string;
  description: string;
  className?: string;
  onFilesSelected: (files: FileList | null) => void;
}

export function FileUploadDropzone({
  accept,
  multiple = false,
  title,
  description,
  className,
  onFilesSelected,
}: FileUploadDropzoneProps) {
  const inputId = React.useId();

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'block cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition hover:bg-muted/30',
        className
      )}
    >
      <Input
        id={inputId}
        type='file'
        accept={accept}
        multiple={multiple}
        className='sr-only'
        onChange={(event) => {
          onFilesSelected(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <span className='flex flex-col items-center gap-3'>
        <span className='flex h-12 w-12 items-center justify-center rounded-full bg-muted'>
          <CloudUpload className='h-6 w-6 text-muted-foreground' />
        </span>
        <span className='space-y-1'>
          <span className='block text-sm font-medium text-foreground'>
            {title}
          </span>
          <span className='block text-xs text-muted-foreground'>
            {description}
          </span>
        </span>
      </span>
    </label>
  );
}
