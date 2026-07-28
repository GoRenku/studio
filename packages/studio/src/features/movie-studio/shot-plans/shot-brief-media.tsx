import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { VideoPlayer } from '@/ui/video-player';
import { VideoPreview } from '@/ui/video-preview';
import type {
  ShotDesignMotion,
  ShotDesignStill,
} from '../shot-design/shot-design-media';

export function ShotBriefStillMedia({
  images,
  label,
  className,
  slotLabels,
}: {
  images: PreviewImage[];
  label: string;
  className?: string;
  slotLabels?: string[];
}) {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <>
      <span
        className={cn(
          'relative grid h-full w-full grid-flow-col auto-cols-fr overflow-hidden',
          className
        )}
      >
        {images.map((image, index) => (
          <Button
            key={`${image.src}-${index}`}
            ref={(element) => {
              triggerRefs.current[index] = element;
            }}
            type='button'
            variant='ghost'
            className='relative h-full min-w-0 overflow-hidden rounded-none p-0 hover:bg-transparent'
            aria-label={images.length > 1 ? `Inspect ${image.title}` : label}
            onClick={() => setCurrentIndex(index)}
          >
            <img
              src={image.src}
              alt={image.alt}
              className='h-full w-full object-cover'
            />
            {slotLabels?.[index] ? (
              <span className='pointer-events-none absolute bottom-2 left-2 rounded-sm bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white'>
                {slotLabels[index]}
              </span>
            ) : null}
          </Button>
        ))}
        {images.length === 2 ? (
          <span
            aria-hidden='true'
            className='pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/75 text-primary shadow-md'
          >
            <ArrowRight className='h-3 w-3' />
          </span>
        ) : null}
      </span>
      {currentIndex !== null ? (
        <ImagePreviewDialog
          images={images}
          currentIndex={currentIndex}
          onCurrentIndexChange={setCurrentIndex}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              const trigger = triggerRefs.current[currentIndex];
              setCurrentIndex(null);
              window.setTimeout(() => trigger?.focus(), 0);
            }
          }}
        />
      ) : null}
    </>
  );
}

export function ShotBriefMotionMedia({
  media,
  label,
  className,
}: {
  media: ShotDesignMotion | ShotDesignStill;
  label: string;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const reducedMotion = useReducedMotion();
  if (media.kind === 'still') {
    return (
      <ShotBriefStillMedia
        images={[
          {
            src: media.imageUrl,
            alt: label,
            title: label,
          },
        ]}
        label={`Inspect ${label}`}
        className={className}
      />
    );
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          className={className}
          aria-label={`Inspect ${label}`}
          onPointerEnter={() => setActive(true)}
          onPointerLeave={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
        >
          <img
            src={media.posterUrl}
            alt=''
            aria-hidden='true'
            className='h-full w-full object-cover'
          />
          {!reducedMotion ? (
            <VideoPreview
              src={media.videoUrl}
              title={`${label} motion preview`}
              active={active}
              className='absolute inset-0 h-full w-full object-cover'
            />
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className='h-[min(760px,calc(100vh-3rem))] max-w-[min(1120px,calc(100vw-3rem))] gap-0 p-5'>
        <DialogTitle className='sr-only'>{label}</DialogTitle>
        <DialogDescription className='sr-only'>
          Full-size motion preview.
        </DialogDescription>
        <VideoPlayer
          src={media.videoUrl}
          title={label}
          className='h-full w-full object-contain'
        />
      </DialogContent>
    </Dialog>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}
