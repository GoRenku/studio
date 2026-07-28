import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { VideoPreview } from '@/ui/video-preview';
import {
  CAMERA_ANGLE_OPTIONS,
  MOVEMENT_OPTIONS,
  SHOT_SIZE_OPTIONS,
} from '../shot-design/shot-design-media';

export type ShotDesignGlossaryKind = 'framing' | 'camera' | 'motion';

export function ShotDesignGlossaryDialog({
  kind,
  current,
  start,
  end,
}: {
  kind: ShotDesignGlossaryKind;
  current?: string;
  start?: string;
  end?: string;
}) {
  const definition = glossaryDefinition(kind);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='absolute bottom-2 right-2 h-7 w-7 rounded-full border border-primary/45 text-primary hover:bg-primary/10'
          aria-label={`Open ${definition.title}`}
        >
          <CircleHelp className='h-3.5 w-3.5' />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100vh-56px)] w-[min(1120px,calc(100vw-56px))] max-w-none gap-0 overflow-hidden p-0'>
        <DialogHeader>
          <DialogTitle>{definition.title}</DialogTitle>
          <DialogDescription>
            {definition.subtitle} · {definition.options.length} options
          </DialogDescription>
        </DialogHeader>
        <div className='overflow-y-auto p-[18px]'>
          <div className='grid grid-cols-[repeat(auto-fit,minmax(185px,1fr))] gap-3'>
            {definition.options.map((option) => (
              <GlossaryCard
                key={option.id}
                option={option}
                statuses={optionStatuses(option.id, {
                  kind,
                  current,
                  start,
                  end,
                })}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GlossaryCard({
  option,
  statuses,
}: {
  option: {
    id: string;
    label: string;
    imageUrl?: string;
    videoUrl?: string;
  };
  statuses: string[];
}) {
  const [active, setActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return (
    <article
      tabIndex={0}
      className={[
        'overflow-hidden rounded-md border bg-card outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
        statuses.length ? 'border-primary/70' : 'border-border/50',
      ].join(' ')}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <div className='relative aspect-video overflow-hidden bg-muted'>
        {option.imageUrl ? (
          <img
            src={option.imageUrl}
            alt=''
            aria-hidden='true'
            className='h-full w-full object-cover'
          />
        ) : null}
        {option.videoUrl && !reducedMotion ? (
          <VideoPreview
            src={option.videoUrl}
            title={`${option.label} motion example`}
            active={active}
            className='absolute inset-0 h-full w-full object-cover'
          />
        ) : null}
      </div>
      <div className='flex min-h-10 items-center justify-between gap-2 px-3 py-2'>
        <span className='text-xs font-medium'>{option.label}</span>
        {statuses.length ? (
          <span className='rounded-full border border-primary/45 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-primary'>
            {statuses.join(' · ')}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function glossaryDefinition(kind: ShotDesignGlossaryKind) {
  if (kind === 'framing') {
    return {
      title: 'Framing Guide',
      subtitle: 'Compare canonical shot sizes',
      options: SHOT_SIZE_OPTIONS,
    };
  }
  if (kind === 'camera') {
    return {
      title: 'Camera Angle Guide',
      subtitle: 'Compare canonical camera angles',
      options: CAMERA_ANGLE_OPTIONS,
    };
  }
  return {
    title: 'Motion Guide',
    subtitle: 'Compare canonical camera movements',
    options: MOVEMENT_OPTIONS,
  };
}

function optionStatuses(
  optionId: string,
  input: {
    kind: ShotDesignGlossaryKind;
    current?: string;
    start?: string;
    end?: string;
  }
): string[] {
  if (input.kind !== 'framing') {
    return input.current === optionId ? ['Current'] : [];
  }
  const statuses: string[] = [];
  if (input.start === optionId) {
    statuses.push('Start');
  }
  if (input.end === optionId) {
    statuses.push('End');
  }
  return statuses;
}
