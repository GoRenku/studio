import type { ScreenplayImageReferenceWithHttp } from '@gorenku/studio-core/client';

interface ScreenplayPrimaryImageProps {
  image?: ScreenplayImageReferenceWithHttp;
  label: string;
  placeholder: string;
}

export function ScreenplayPrimaryImage({
  image,
  label,
  placeholder,
}: ScreenplayPrimaryImageProps) {
  return (
    <div className='aspect-[4/3] overflow-hidden rounded-md border border-border/40 bg-muted'>
      {image ? (
        <img src={image.url} alt={label} className='h-full w-full object-cover' />
      ) : (
        <div className='flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground'>
          {placeholder}
        </div>
      )}
    </div>
  );
}
