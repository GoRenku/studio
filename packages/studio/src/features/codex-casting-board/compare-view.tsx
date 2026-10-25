import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import { CandidateCastAction, OverlayIconButton } from '@/features/casting-views/candidate-actions';
import { usePanelMediaUrls, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible';
import { handleImageZoomKey, useImageZoom, type ImageZoom } from '@/ui/image-zoom';
import { ImageZoomControls } from '@/ui/image-zoom-controls';
import { ZoomableImage } from '@/ui/zoomable-image';
import type { BoardCandidate } from './board-summaries';

/**
 * Two shortlisted candidates side by side with one shared zoom: the favorite stays on the left
 * while the rest of the shortlist comes in on the right, one at a time.
 */
export function CompareView(input: {
  candidates: BoardCandidate[];
  castAssetFileId: string | null;
  media: PanelMediaLibrary;
  disabled: boolean;
  castDisabled: boolean;
  onCast: (assetFileId: string) => void;
  onRemoveFromShortlist: (assetFileId: string) => void;
}) {
  const { candidates } = input;
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [challengerId, setChallengerId] = useState<string | null>(null);
  const [stripOpen, setStripOpen] = useState(true);
  const zoom = useImageZoom();
  const urls = usePanelMediaUrls(input.media, candidates.map((candidate) => candidate.imageUri));
  const favorite = candidates.find((candidate) => candidate.assetFileId === favoriteId) ?? candidates[0];
  const challengers = candidates.filter((candidate) => candidate !== favorite);
  const challenger = challengers.find((candidate) => candidate.assetFileId === challengerId) ?? challengers[0];
  const challengerIndex = challenger ? challengers.indexOf(challenger) : -1;

  const step = (offset: number) => {
    if (challengers.length < 2) return;
    setChallengerId(challengers[(challengerIndex + offset + challengers.length) % challengers.length]!.assetFileId);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const offset = COMPARE_STEP_KEYS[event.key];
      if (offset !== undefined) {
        event.preventDefault();
        step(offset);
      } else if (handleImageZoomKey(event.key, zoom)) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!favorite) return null;

  const makeFavorite = () => {
    if (!challenger) return;
    setFavoriteId(challenger.assetFileId);
    setChallengerId(favorite.assetFileId);
  };
  const removeChallenger = () => {
    if (!challenger) return;
    const next = challengers.length > 1 ? challengers[(challengerIndex + 1) % challengers.length] : undefined;
    setChallengerId(next?.assetFileId ?? null);
    input.onRemoveFromShortlist(challenger.assetFileId);
  };

  return (
    <Collapsible open={stripOpen} onOpenChange={setStripOpen} className='flex min-h-0 flex-1 flex-col'>
      <div className={cn('grid min-h-0 flex-1 gap-px border-y border-[var(--dd-border)] bg-[var(--dd-border)]', challenger ? 'grid-cols-2' : 'grid-cols-1')}>
        <CompareSide
          label='Favorite'
          candidate={favorite}
          url={urls.get(favorite.imageUri)}
          zoom={zoom}
          measuresZoom
          isCast={favorite.assetFileId === input.castAssetFileId}
          castDisabled={input.castDisabled}
          onCast={() => input.onCast(favorite.assetFileId)}
          header={<span className='inline-flex items-center gap-1 rounded-full bg-[var(--dd-primary)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--dd-primary-fg)]'><Star aria-hidden='true' className='h-3 w-3' />Favorite</span>}
        />
        {challenger ? (
          <CompareSide
            label='Challenger'
            candidate={challenger}
            url={urls.get(challenger.imageUri)}
            zoom={zoom}
            isCast={challenger.assetFileId === input.castAssetFileId}
            castDisabled={input.castDisabled}
            onCast={() => input.onCast(challenger.assetFileId)}
            header={(
              <>
                <Button type='button' variant='ghost' size='icon' aria-label='Previous challenger' title='Previous' disabled={challengers.length < 2} className='h-7 w-7' onClick={() => step(-1)}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='min-w-[3rem] text-center font-mono text-[11.5px] tabular-nums text-[var(--dd-muted-fg)]'>{challengerIndex + 1} / {challengers.length}</span>
                <Button type='button' variant='ghost' size='icon' aria-label='Next challenger' title='Next' disabled={challengers.length < 2} className='h-7 w-7' onClick={() => step(1)}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </>
            )}
            overlay={(
              <>
                <OverlayIconButton label='Make favorite' onClick={makeFavorite}><Star className='h-3 w-3' /></OverlayIconButton>
                <OverlayIconButton label='Remove from shortlist' disabled={input.disabled} onClick={removeChallenger}><X className='h-3 w-3' /></OverlayIconButton>
              </>
            )}
          />
        ) : null}
      </div>
      <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-[18px] py-2'>
        <span />
        <ImageZoomControls zoom={zoom} className='shadow-none' />
        <CollapsibleTrigger asChild>
          <Button type='button' variant='ghost' size='sm' className='justify-self-end gap-1 text-[12px]'>
            Shortlist {candidates.length}
            <ChevronDown aria-hidden='true' className={cn('h-3.5 w-3.5 transition-transform', stripOpen ? null : '-rotate-90')} />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <nav aria-label='Shortlist' className='flex gap-2 overflow-x-auto px-[18px] pb-3'>
          {candidates.map((candidate) => {
            const url = urls.get(candidate.imageUri);
            const isFavorite = candidate === favorite;
            const isChallenger = candidate === challenger;
            return (
              <Button
                key={candidate.assetFileId}
                type='button'
                variant='ghost'
                aria-label={isFavorite ? 'Favorite' : `Compare round ${candidate.roundNumber} · ${candidate.model.name}`}
                aria-current={isChallenger}
                disabled={isFavorite}
                onClick={() => setChallengerId(candidate.assetFileId)}
                className={cn(
                  'relative size-16 flex-none overflow-hidden rounded-lg border-2 border-transparent bg-[var(--dd-muted)] p-0 hover:bg-[var(--dd-muted)] disabled:opacity-100',
                  (isFavorite || isChallenger) && 'border-[var(--dd-primary)]',
                )}
              >
                {url ? <img alt='' src={url} className='size-full object-cover' /> : null}
                {isFavorite ? <Star aria-hidden='true' className='absolute bottom-1 left-1 h-3 w-3 fill-[var(--dd-primary)] text-[var(--dd-primary)]' /> : null}
              </Button>
            );
          })}
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}

const COMPARE_STEP_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

function CompareSide(input: {
  label: string;
  candidate: BoardCandidate;
  url: string | undefined;
  zoom: ImageZoom;
  /** The favorite's stage sizes the shared zoom steps; the challenger follows the same view. */
  measuresZoom?: boolean;
  isCast: boolean;
  castDisabled: boolean;
  onCast: () => void;
  header: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <section aria-label={input.label} className='flex min-h-0 flex-col bg-[var(--dd-bg)]'>
      <div className='flex h-11 flex-none items-center justify-center gap-1.5 border-b border-[var(--dd-border)]'>{input.header}</div>
      <div className='relative min-h-0 flex-1 bg-[var(--dd-muted)]'>
        {input.url ? (
          <ZoomableImage
            src={input.url}
            alt={`Round ${input.candidate.roundNumber} · ${input.candidate.model.name}`}
            view={input.zoom.view}
            onViewChange={input.zoom.onViewChange}
            onLayoutChange={input.measuresZoom ? input.zoom.onLayoutChange : undefined}
            className='h-full w-full'
          />
        ) : null}
        {input.overlay ? <span className='absolute right-2 top-2 flex gap-1.5'>{input.overlay}</span> : null}
        <CandidateCastAction isCast={input.isCast} disabled={input.castDisabled} onCast={input.onCast} className='absolute bottom-2 right-2 h-7' />
      </div>
    </section>
  );
}
