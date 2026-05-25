import * as React from 'react';
import { CloudUpload } from 'lucide-react';
import { Input } from '@/ui/input';
import { cn } from '@/lib/utils';

interface FileUploadDropzoneProps {
  accept?: string;
  multiple?: boolean;
  title: string;
  description?: string;
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
        'flex min-h-40 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border/40 bg-muted/20 p-8 text-center transition-colors hover:border-border/60 hover:bg-item-hover-bg',
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
      <span className='flex flex-col items-center justify-center gap-3'>
        <span className='flex h-12 w-12 items-center justify-center rounded-full bg-muted/70 text-muted-foreground'>
          <CloudUpload className='h-5 w-5' />
        </span>
        <span className='space-y-1 text-center'>
          <span className='block text-sm font-medium leading-none text-foreground'>
            {title}
          </span>
          {description ? (
            <span className='block max-w-64 text-xs leading-5 text-muted-foreground'>
              {description}
            </span>
          ) : null}
        </span>
      </span>
    </label>
  );
}
