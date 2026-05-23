import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisualLanguageImageCardProps {
  src?: string;
  alt: string;
  title?: string;
  className?: string;
}

export function VisualLanguageImageCard({
  src,
  alt,
  title,
  className,
}: VisualLanguageImageCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border/40 bg-card',
        className
      )}
    >
      <div className='aspect-video bg-muted/30'>
        {src ? (
          <img src={src} alt={alt} className='h-full w-full object-cover' />
        ) : (
          <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
            <ImageOff className='h-5 w-5' />
          </div>
        )}
      </div>
      {title ? (
        <div className='h-9 truncate border-t border-border/40 px-2 py-2 text-xs text-muted-foreground'>
          {title}
        </div>
      ) : null}
    </div>
  );
}
