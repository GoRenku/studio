import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { MediaCard } from '@/ui/media-card/media-card';
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
  onDeleteImage,
}: {
  images: ReportImage[];
  size: 'feature' | 'compact';
  className?: string;
  onOpenImage: (image: PreviewImage) => void;
  onDeleteImage?: (image: ReportImage) => Promise<void>;
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
      {images.map((image) => {
        const title = readableImageTitle(image);
        return (
          <MediaCard
            key={image.id}
            media={{
              kind: 'image',
              src: image.src,
              alt: image.alt,
              fit: 'cover',
              effect: 'none',
            }}
            frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
            presentation={{
              kind: 'evidence',
              copy: image.lookbookImageId
                ? { kind: 'label', label: title }
                : undefined,
            }}
            activation={{
              label: title,
              onActivate: () =>
                onOpenImage({
                  src: image.src,
                  alt: image.alt,
                  title,
                }),
            }}
            deleteAction={
              image.lookbookImageId && onDeleteImage
                ? {
                    label: `Delete ${title}`,
                    confirmationTitle: 'Delete Image?',
                    confirmationMessage:
                      'Remove this image from the lookbook. This cannot be undone.',
                    onDelete: () => onDeleteImage(image),
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

export function EvidenceFeatureCard({
  image,
  title,
  description,
  onOpenImage,
  onDeleteImage,
}: {
  image: ReportImage;
  title?: string;
  description: string;
  onOpenImage: (image: PreviewImage) => void;
  onDeleteImage?: (image: ReportImage) => Promise<void>;
}) {
  const readableTitle = readableImageTitle(image);
  return (
    <div data-lookbook-evidence-layout='single'>
      <MediaCard
        media={{
          kind: 'image',
          src: image.src,
          alt: image.alt,
          fit: 'cover',
          effect: 'none',
        }}
        frame={{ kind: 'minimum-height', minimumHeightPx: 320 }}
        presentation={{
          kind: 'evidence',
          copy: {
            kind: 'feature',
            title,
            description,
          },
        }}
        activation={{
          label: readableTitle,
          onActivate: () =>
            onOpenImage({
              src: image.src,
              alt: image.alt,
              title: readableTitle,
            }),
        }}
        deleteAction={
          onDeleteImage && image.lookbookImageId
            ? {
                label: `Delete ${readableTitle}`,
                confirmationTitle: 'Delete Image?',
                confirmationMessage:
                  'Remove this image from the lookbook. This cannot be undone.',
                onDelete: () => onDeleteImage(image),
              }
            : undefined
        }
      />
    </div>
  );
}
