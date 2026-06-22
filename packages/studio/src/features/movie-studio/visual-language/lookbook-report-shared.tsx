import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import {
  readableImageTitle,
  type ReportImage,
} from './lookbook-report-images';

export function LookbookReportFrame({
  children,
  hasHeader,
}: {
  children: ReactNode;
  hasHeader: boolean;
}) {
  return (
    <article
      className={cn(
        'min-h-full bg-panel-bg px-4 text-foreground',
        hasHeader ? 'py-5' : 'py-0'
      )}
    >
      {children}
    </article>
  );
}

export function LookbookReportHeader({
  title,
  headerMeta,
  action,
}: {
  title?: string;
  headerMeta?: ReactNode;
  action?: ReactNode;
}) {
  if (!title && !headerMeta && !action) return null;
  return (
    <header className='flex flex-col gap-5 pb-8'>
      <div className='flex flex-wrap items-end justify-between gap-5'>
        <div className='min-w-0'>
          {title ? (
            <h1 className='max-w-[920px] text-3xl font-black leading-none text-foreground sm:text-4xl lg:text-5xl'>
              {title}
            </h1>
          ) : null}
        </div>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>
      {headerMeta ? <div>{headerMeta}</div> : null}
    </header>
  );
}

export function LookbookReportSection({
  number,
  kicker,
  title,
  children,
}: {
  number: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='grid gap-6 border-t border-border/40 py-8 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)] lg:gap-8'>
      <div>
        <p className='font-mono text-xs uppercase text-muted-foreground'>
          {number} - {kicker}
        </p>
        <h2 className='mt-3 text-xl font-black uppercase tracking-tight text-foreground sm:text-2xl'>
          {title}
        </h2>
      </div>
      <div className='min-w-0'>{children}</div>
    </section>
  );
}

export function SectionWideContent({ children }: { children: ReactNode }) {
  return <div className='pb-10 sm:pb-12'>{children}</div>;
}

export function LookbookReportProse({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'max-w-[820px] text-sm leading-7 text-foreground/80',
        className
      )}
    >
      {children}
    </p>
  );
}

export function EvidenceGrid({
  images,
  size,
  className,
  onOpenImage,
  onRequestDeleteImage,
}: {
  images: ReportImage[];
  size: 'feature' | 'compact';
  className?: string;
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  if (!images.length) return null;
  return (
    <div
      className={cn(
        'grid gap-3',
        size === 'feature'
          ? 'grid-cols-[repeat(auto-fit,minmax(210px,1fr))]'
          : 'grid-cols-[repeat(auto-fit,minmax(96px,1fr))]',
        className
      )}
    >
      {images.map((image) => (
        <EvidenceImage
          key={image.id}
          image={image}
          size={size}
          onOpen={() =>
            onOpenImage({
              src: image.src,
              alt: image.alt,
              title: readableImageTitle(image),
            })
          }
          onRequestDelete={
            image.lookbookImageId && onRequestDeleteImage
              ? () => onRequestDeleteImage(image)
              : undefined
          }
        />
      ))}
    </div>
  );
}

export function EvidenceFeatureCard({
  image,
  title,
  description,
  onOpenImage,
  onRequestDeleteImage,
}: {
  image: ReportImage;
  title?: string;
  description: string;
  onOpenImage: (image: PreviewImage) => void;
  onRequestDeleteImage?: (image: ReportImage) => void;
}) {
  return (
    <figure
      className='group relative min-h-[320px] overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.32)]'
      title={image.title}
      data-lookbook-evidence-layout='single'
    >
      <Button
        type='button'
        variant='ghost'
        className='block h-full min-h-[320px] w-full rounded-none p-0 hover:bg-transparent'
        onClick={() =>
          onOpenImage({
            src: image.src,
            alt: image.alt,
            title: readableImageTitle(image),
          })
        }
      >
        <img
          src={image.src}
          alt={image.alt}
          className='h-full min-h-[320px] w-full object-cover'
        />
      </Button>
      <figcaption className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/62 to-transparent px-5 pb-5 pt-20 text-white'>
        {title ? (
          <h3 className='text-lg font-black leading-tight text-white'>{title}</h3>
        ) : null}
        <p className='mt-2 max-w-[720px] text-sm font-semibold leading-6 text-white/82'>
          {description}
        </p>
      </figcaption>
      {onRequestDeleteImage && image.lookbookImageId ? (
        <span className='absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='h-7 w-7 bg-black/50 text-white shadow-sm hover:bg-destructive hover:text-destructive-foreground'
                aria-label={`Delete ${readableImageTitle(image)}`}
                onClick={() => onRequestDeleteImage(image)}
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete image</TooltipContent>
          </Tooltip>
        </span>
      ) : null}
    </figure>
  );
}

function EvidenceImage({
  image,
  size,
  onOpen,
  onRequestDelete,
}: {
  image: ReportImage;
  size: 'feature' | 'compact';
  onOpen: () => void;
  onRequestDelete?: () => void;
}) {
  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.3)]',
        size === 'feature' ? 'min-h-0' : 'min-h-0'
      )}
      title={image.title}
    >
      <Button
        type='button'
        variant='ghost'
        className='block h-auto w-full rounded-none p-0 hover:bg-transparent'
        onClick={onOpen}
      >
        <span className='block aspect-video'>
          <img
            src={image.src}
            alt={image.alt}
            className='h-full w-full object-cover'
          />
        </span>
      </Button>
      {image.lookbookImageId ? (
        <figcaption className='pointer-events-none absolute bottom-2 left-2 right-2 flex justify-start'>
          <span className='max-w-full overflow-hidden rounded-sm border border-border/20 bg-panel-bg/70 px-2 py-1 text-[10px] font-medium leading-4 text-foreground/65 shadow-sm backdrop-blur-sm transition-opacity group-hover:text-foreground/85 group-focus-within:text-foreground/85 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'>
            {readableImageTitle(image)}
          </span>
        </figcaption>
      ) : null}
      {onRequestDelete ? (
        <span className='absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='h-7 w-7 bg-black/50 text-white shadow-sm hover:bg-destructive hover:text-destructive-foreground'
                aria-label={`Delete ${readableImageTitle(image)}`}
                onClick={onRequestDelete}
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete image</TooltipContent>
          </Tooltip>
        </span>
      ) : null}
    </figure>
  );
}
