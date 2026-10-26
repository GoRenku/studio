import { useEffect, useLayoutEffect, useState } from 'react';
import type { CastingRoundKind } from '@gorenku/studio-core/client';
import { ChevronLeft, ChevronRight, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { handleImageZoomKey, useImageZoom, type ImageZoom } from '@/ui/image-zoom';
import { ImageZoomControls } from '@/ui/image-zoom-controls';
import { ZoomableImage } from '@/ui/zoomable-image';
import { CandidateChoiceAction } from './candidate-actions';
import { CASTING_ROUND_KIND_LABELS } from './round-kind-labels';
import { compareArrangement, type CompareArrangement } from './compare-arrangement';

/** A kept candidate or sheet as Compare shows it; the caller resolves the image URL. */
export interface CompareCandidate {
  assetFileId: string;
  imageUrl: string | undefined;
  /** "Round 1 · Model": the image's alt text. */
  label: string;
}

type CompareSideKey = 'first' | 'second';

/**
 * Two kept images of a Look's or costume's rounds side by side (or stacked when that shows both
 * larger) with one shared zoom. Each side steps through the images on its own, skipping the one the
 * other side shows, so one side can stay put while the other walks the rest. Each side casts (or
 * picks) or hides its own image.
 */
export function CompareView(input: {
  kind: CastingRoundKind;
  candidates: CompareCandidate[];
  chosenAssetFileId: string | null;
  disabled: boolean;
  chooseDisabled: boolean;
  onChoose: (assetFileId: string) => void;
  onHide: (assetFileId: string) => void;
}) {
  const { candidates } = input;
  const [picks, setPicks] = useState<Record<CompareSideKey, string | null>>({ first: null, second: null });
  const zoom = useImageZoom();
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const [areaSize, setAreaSize] = useState<{ width: number; height: number } | null>(null);
  const byId = (assetFileId: string | null) => candidates.find((candidate) => candidate.assetFileId === assetFileId);
  const first = byId(picks.first) ?? candidates.find((candidate) => candidate.assetFileId !== picks.second) ?? candidates[0];
  const second = (picks.second !== first?.assetFileId ? byId(picks.second) : undefined)
    ?? candidates.find((candidate) => candidate !== first);
  const shown: Record<CompareSideKey, CompareCandidate | undefined> = { first, second };

  /** The candidate `offset` steps from the side's own, skipping the other side's. */
  const stepFrom = (side: CompareSideKey, offset: number): CompareCandidate | undefined => {
    const current = shown[side];
    const other = shown[side === 'first' ? 'second' : 'first'];
    const choices = candidates.filter((candidate) => candidate === current || candidate !== other);
    if (!current || choices.length < 2) return undefined;
    return choices[(choices.indexOf(current) + offset + choices.length) % choices.length];
  };
  const step = (side: CompareSideKey, offset: number) => {
    const next = stepFrom(side, offset);
    if (next) setPicks((current) => ({ ...current, [side]: next.assetFileId }));
  };
  const hide = (side: CompareSideKey) => {
    const current = shown[side];
    if (!current) return;
    setPicks((picked) => ({ ...picked, [side]: stepFrom(side, 1)?.assetFileId ?? null }));
    input.onHide(current.assetFileId);
  };

  useLayoutEffect(() => {
    if (!area) return;
    const measure = () => setAreaSize({ width: area.clientWidth, height: area.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [area]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const offset = COMPARE_STEP_KEYS[event.key];
      if (offset !== undefined) {
        event.preventDefault();
        step('second', offset);
      } else if (handleImageZoomKey(event.key, zoom)) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!first) return null;
  const { noun } = CASTING_ROUND_KIND_LABELS[input.kind];

  const arrangement: CompareArrangement = areaSize && zoom.layout
    ? compareArrangement({
      areaWidth: areaSize.width,
      areaHeight: areaSize.height,
      imageWidth: zoom.layout.imageWidth,
      imageHeight: zoom.layout.imageHeight,
    })
    : 'side-by-side';
  const side = (key: CompareSideKey, candidate: CompareCandidate, label: string) => (
    <CompareSide
      label={label}
      candidate={candidate}
      position={candidates.indexOf(candidate) + 1}
      total={candidates.length}
      zoom={zoom}
      measuresZoom={key === 'first'}
      canStep={stepFrom(key, 1) !== undefined}
      kind={input.kind}
      isChosen={candidate.assetFileId === input.chosenAssetFileId}
      disabled={input.disabled}
      chooseDisabled={input.chooseDisabled}
      onStep={(offset) => step(key, offset)}
      onHide={() => hide(key)}
      onChoose={() => input.onChoose(candidate.assetFileId)}
    />
  );

  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      <div
        ref={setArea}
        className={cn(
          'grid min-h-0 flex-1 gap-px border-t border-panel-border bg-panel-border',
          second ? COMPARE_GRID_CLASS[arrangement] : 'grid-cols-1',
        )}
      >
        {side('first', first, `First ${noun}`)}
        {second ? side('second', second, `Second ${noun}`) : null}
      </div>
      <ImageZoomControls zoom={zoom} className='absolute bottom-3 left-1/2 z-10 -translate-x-1/2' />
    </div>
  );
}

const COMPARE_STEP_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

const COMPARE_GRID_CLASS: Record<CompareArrangement, string> = { 'side-by-side': 'grid-cols-2', stacked: 'grid-rows-2' };

function CompareSide(input: {
  label: string;
  candidate: CompareCandidate;
  position: number;
  total: number;
  zoom: ImageZoom;
  /** The first side's stage sizes the shared zoom steps; the second follows the same view. */
  measuresZoom: boolean;
  canStep: boolean;
  kind: CastingRoundKind;
  isChosen: boolean;
  disabled: boolean;
  chooseDisabled: boolean;
  onStep: (offset: number) => void;
  onHide: () => void;
  onChoose: () => void;
}) {
  return (
    <section aria-label={input.label} className='flex min-h-0 flex-col bg-panel-bg'>
      <div className='grid h-11 flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-panel-border px-2.5'>
        <span className='col-start-2 flex items-center gap-1'>
          <Button type='button' variant='ghost' size='icon' aria-label={`Previous ${CASTING_ROUND_KIND_LABELS[input.kind].noun}`} title='Previous' disabled={!input.canStep} className='h-7 w-7' onClick={() => input.onStep(-1)}>
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <span className='min-w-[3.5rem] text-center font-mono text-[11.5px] tabular-nums text-muted-foreground'>{input.position} of {input.total}</span>
          <Button type='button' variant='ghost' size='icon' aria-label={`Next ${CASTING_ROUND_KIND_LABELS[input.kind].noun}`} title='Next' disabled={!input.canStep} className='h-7 w-7' onClick={() => input.onStep(1)}>
            <ChevronRight className='h-4 w-4' />
          </Button>
        </span>
        <span className='flex items-center justify-self-end gap-1.5'>
          <Button type='button' variant='outline' size='sm' disabled={input.disabled} className='h-7 gap-1.5 text-[12px]' onClick={input.onHide}>
            <EyeOff aria-hidden='true' className='h-3.5 w-3.5' />Hide
          </Button>
          <CandidateChoiceAction kind={input.kind} isChosen={input.isChosen} disabled={input.chooseDisabled} onChoose={input.onChoose} className='h-7' />
        </span>
      </div>
      <div className='relative min-h-0 flex-1 bg-muted'>
        {input.candidate.imageUrl ? (
          <ZoomableImage
            src={input.candidate.imageUrl}
            alt={input.candidate.label}
            view={input.zoom.view}
            onViewChange={input.zoom.onViewChange}
            onLayoutChange={input.measuresZoom ? input.zoom.onLayoutChange : undefined}
            className='h-full w-full'
          />
        ) : null}
      </div>
    </section>
  );
}
