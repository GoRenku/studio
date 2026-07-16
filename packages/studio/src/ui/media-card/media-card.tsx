import { useState, type FocusEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { useImageAspectRatio } from '@/ui/image-aspect-ratio';
import { MediaCardActions } from './media-card-actions';
import type {
  MediaCardMedia,
  MediaCardPresentation,
  MediaCardProps,
  MediaCardSummaryBody,
} from './media-card-contract';
import { MediaCardVisual } from './media-card-visual';

export function MediaCard({
  media,
  frame,
  presentation,
  activation,
  selected,
  selection,
  editAction,
  deleteAction,
  emptyState,
}: MediaCardProps) {
  const [active, setActive] = useState(false);
  const selectedState = selection?.selected ?? selected ?? false;
  const option = presentation.kind === 'thumbnail' && isOptionMedia(media);
  const mosaic = presentation.kind === 'thumbnail' && media?.kind === 'mosaic';
  const hasLowerActions = Boolean(selection || editAction);
  const imageKey =
    frame.kind === 'ratio' &&
    frame.detectFromImage &&
    media?.kind === 'image'
      ? media.src
      : null;
  const { aspectRatioStyle, onImageLoad } = useImageAspectRatio(
    frame.kind === 'ratio' ? frame.aspectRatio : 1,
    imageKey
  );
  const overlayRatio =
    presentation.kind === 'overlay' && frame.kind === 'ratio';

  return (
    <Card
      data-media-card=''
      data-media-card-presentation={presentation.kind}
      className={mediaCardClass({
        presentation,
        selected: selectedState,
        option,
        mosaic,
        disabled: Boolean(activation?.disabled),
      })}
      style={overlayRatio ? aspectRatioStyle : undefined}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={(event) => {
        if (!containsRelatedTarget(event)) {
          setActive(false);
        }
      }}
    >
      <div
        className={
          overlayRatio
            ? 'absolute inset-0 overflow-hidden rounded-[inherit]'
            : 'relative'
        }
      >
        <MediaCardVisual
          media={media}
          frame={frame}
          presentation={presentation}
          emptyState={emptyState}
          selected={selectedState}
          active={active}
          aspectRatioStyle={overlayRatio ? undefined : aspectRatioStyle}
          onImageLoad={imageKey ? onImageLoad : undefined}
        />
        <MediaCardVisualCopy
          presentation={presentation}
          hasLowerActions={hasLowerActions}
        />
        <MediaCardActions
          selection={selection}
          editAction={editAction}
          deleteAction={deleteAction}
        />
      </div>
      <MediaCardBelowVisual
        presentation={presentation}
        selected={selectedState}
        option={option}
      />
      {activation ? (
        <Button
          type='button'
          variant='ghost'
          aria-label={activation.label}
          disabled={activation.disabled}
          className='absolute inset-0 z-20 h-full w-full overflow-hidden rounded-[inherit] p-0 text-left hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          onClick={activation.onActivate}
        />
      ) : null}
    </Card>
  );
}

function MediaCardVisualCopy({
  presentation,
  hasLowerActions,
}: {
  presentation: MediaCardPresentation;
  hasLowerActions: boolean;
}) {
  if (presentation.kind === 'overlay') {
    if (!presentation.copy && !hasLowerActions) {
      return null;
    }
    return (
      <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0.78)_100%)] px-4 pb-3 pt-12'>
        {presentation.copy ? (
          <div className={cn('min-w-0', hasLowerActions ? 'pr-12' : null)}>
            {presentation.copy.title ? (
              <h3 className='truncate text-sm font-semibold leading-5 text-white'>
                {presentation.copy.title}
              </h3>
            ) : null}
            {presentation.copy.description ? (
              <p className='mt-0.5 truncate text-xs leading-5 text-white/72'>
                {presentation.copy.description}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  if (presentation.kind !== 'evidence' || !presentation.copy) {
    return null;
  }
  if (presentation.copy.kind === 'label') {
    return (
      <div className='pointer-events-none absolute bottom-2 left-2 right-2 flex justify-start'>
        <span className='max-w-full overflow-hidden rounded-sm border border-border/20 bg-panel-bg/70 px-2 py-1 text-[10px] font-medium leading-4 text-foreground/65 shadow-sm backdrop-blur-sm transition-opacity group-hover:text-foreground/85 group-focus-within:text-foreground/85 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'>
          {presentation.copy.label}
        </span>
      </div>
    );
  }
  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/62 to-transparent px-5 pb-5 pt-20 text-white'>
      {presentation.copy.title ? (
        <h3 className='text-lg font-black leading-tight text-white'>
          {presentation.copy.title}
        </h3>
      ) : null}
      <p className='mt-2 max-w-[720px] text-sm font-semibold leading-6 text-white/82'>
        {presentation.copy.description}
      </p>
    </div>
  );
}

function MediaCardBelowVisual({
  presentation,
  selected,
  option,
}: {
  presentation: MediaCardPresentation;
  selected: boolean;
  option: boolean;
}) {
  if (presentation.kind === 'summary') {
    return <MediaCardSummaryBodyView body={presentation.body} />;
  }
  if (presentation.kind !== 'thumbnail' || !presentation.footer) {
    return null;
  }
  if (option) {
    return (
      <div
        className={cn(
          'px-0.5 text-center text-[11px] leading-tight',
          selected ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        {presentation.footer.title}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex w-full flex-col',
        presentation.footer.eyebrow ? 'gap-0.5 px-2 pb-2' : 'gap-1 px-3 py-3'
      )}
    >
      {presentation.footer.eyebrow ? (
        <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          {presentation.footer.eyebrow}
        </span>
      ) : null}
      <span
        className={cn(
          'truncate text-foreground',
          presentation.footer.eyebrow
            ? 'text-xs text-foreground/85'
            : 'text-sm font-semibold'
        )}
      >
        {presentation.footer.title}
      </span>
      {presentation.footer.description ? (
        <span className='truncate text-xs text-muted-foreground'>
          {presentation.footer.description}
        </span>
      ) : null}
    </div>
  );
}

function MediaCardSummaryBodyView({ body }: { body: MediaCardSummaryBody }) {
  return (
    <div className='space-y-2 p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <h2 className='line-clamp-2 text-sm font-semibold leading-snug'>
            {body.title}
          </h2>
          {body.subtitle ? (
            <p className='mt-1 truncate text-[11px] text-muted-foreground'>
              {body.subtitle}
            </p>
          ) : null}
        </div>
        {body.issue ? (
          <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300' />
        ) : null}
      </div>
      {body.description ? (
        <p className='line-clamp-2 text-xs leading-relaxed text-muted-foreground'>
          {body.description}
        </p>
      ) : null}
      {body.issue ? (
        <p className='line-clamp-2 text-xs leading-relaxed text-red-700 dark:text-red-300'>
          {body.issue.code}: {body.issue.message}
        </p>
      ) : body.metrics?.length ? (
        <div className='flex flex-wrap gap-1.5'>
          {body.metrics.map((metric) => (
            <span
              key={metric.label}
              className='rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground'
            >
              {metric.label}:{' '}
              <span className='font-semibold text-foreground'>
                {metric.value}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function mediaCardClass({
  presentation,
  selected,
  option,
  mosaic,
  disabled,
}: {
  presentation: MediaCardPresentation;
  selected: boolean;
  option: boolean;
  mosaic: boolean;
  disabled: boolean;
}): string {
  return cn(
    'group relative gap-0 py-0',
    presentation.kind === 'overlay'
      ? 'overflow-hidden rounded-md border bg-muted/25 shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_12px_24px_rgba(0,0,0,0.16)]'
      : null,
    presentation.kind === 'evidence'
      ? 'overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.3)]'
      : null,
    presentation.kind === 'summary'
      ? 'overflow-hidden rounded-xl border border-border/40 bg-card shadow-lg transition-all hover:border-primary/70 hover:shadow-xl'
      : null,
    presentation.kind === 'thumbnail' && option
      ? 'gap-1.5 overflow-visible rounded-lg border-0 bg-transparent shadow-none'
      : null,
    presentation.kind === 'thumbnail' && !option
      ? cn(
          'overflow-hidden rounded-md border border-border/40 bg-card transition hover:border-item-active-border',
          mosaic
            ? 'shadow-sm hover:-translate-y-0.5'
            : 'shadow-none hover:bg-card'
        )
      : null,
    selected && presentation.kind === 'overlay'
      ? 'border-primary/70 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ring-1 ring-primary/35'
      : presentation.kind === 'overlay'
        ? 'border-border/40'
        : null,
    disabled ? 'pointer-events-none cursor-not-allowed opacity-75' : null
  );
}

function containsRelatedTarget(event: FocusEvent<HTMLDivElement>): boolean {
  return event.currentTarget.contains(event.relatedTarget as Node | null);
}

function isOptionMedia(media: MediaCardMedia | null): boolean {
  return (
    media?.kind === 'video' ||
    (media?.kind === 'image' &&
      media.effect === 'desaturate-until-hover-or-selected')
  );
}
