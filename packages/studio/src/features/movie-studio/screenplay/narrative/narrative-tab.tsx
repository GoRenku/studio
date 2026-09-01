import { useMemo } from 'react';
import type {
  OpeningElement,
  ScreenplayReference,
  ScreenplaySceneResource,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { NarrativeBlock } from './block';
import { NarrativeOpening } from './opening';
import { NarrativeSceneHeading } from './scene-heading';

interface SceneNeighbor {
  id: string;
  title: string;
}

export function NarrativeTab({
  projectName,
  resource,
  opening,
  openingReferences,
  previousScene,
  nextScene,
  onSelect,
}: {
  projectName: string;
  resource: ScreenplaySceneResource;
  opening: OpeningElement[];
  openingReferences: ScreenplayReference[];
  previousScene?: SceneNeighbor | null;
  nextScene?: SceneNeighbor | null;
  onSelect: (selection: StudioSelection) => void;
}) {
  const turnNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let number = 1;
    for (const block of resource.scene.blocks) {
      if (block.type === 'dialogue') numbers.set(block.id, number++);
      if (block.type === 'dualDialogue') {
        numbers.set(block.left.id, number++);
        numbers.set(block.right.id, number++);
      }
    }
    return numbers;
  }, [resource.scene.blocks]);

  return (
    <div className='flex h-full min-h-0 min-w-0'>
      <div className='min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-10 sm:px-10'>
        <article className='mx-auto max-w-2xl text-foreground'>
          <SceneNav
            previousScene={previousScene}
            nextScene={nextScene}
            onSelect={onSelect}
            placement='top'
          />
          <NarrativeOpening
            projectName={projectName}
            elements={opening}
            references={openingReferences}
            onSelect={onSelect}
          />
          <NarrativeSceneHeading
            projectName={projectName}
            heading={resource.scene.heading}
            references={resource.references.filter(
              (reference) => reference.target.type === 'sceneHeading'
            )}
            onSelect={onSelect}
          />
          <div className='mt-10 flex flex-col gap-7 text-[15.5px] leading-7'>
            {resource.scene.blocks.map((block) => (
              <NarrativeBlock
                key={block.id}
                projectName={projectName}
                block={block}
                references={resource.references}
                turnNumbers={turnNumbers}
                onSelect={onSelect}
              />
            ))}
          </div>
          <SceneNav
            previousScene={previousScene}
            nextScene={nextScene}
            onSelect={onSelect}
            placement='bottom'
          />
        </article>
      </div>
    </div>
  );
}

function SceneNav({
  previousScene,
  nextScene,
  onSelect,
  placement,
}: {
  previousScene?: SceneNeighbor | null;
  nextScene?: SceneNeighbor | null;
  onSelect: (selection: StudioSelection) => void;
  placement: 'top' | 'bottom';
}) {
  return (
    <nav
      aria-label='Scene navigation'
      className={cn(
        'flex items-stretch justify-between gap-4',
        placement === 'top' ? 'mb-8' : 'mt-14'
      )}
    >
      <SceneNavLink
        direction='prev'
        scene={previousScene}
        onSelect={onSelect}
        compact={placement === 'top'}
      />
      <SceneNavLink
        direction='next'
        scene={nextScene}
        onSelect={onSelect}
        compact={placement === 'top'}
      />
    </nav>
  );
}

function SceneNavLink({
  direction,
  scene,
  onSelect,
  compact,
}: {
  direction: 'prev' | 'next';
  scene?: SceneNeighbor | null;
  onSelect: (selection: StudioSelection) => void;
  compact: boolean;
}) {
  const isPrevious = direction === 'prev';
  const label = isPrevious ? 'Previous' : 'Next';
  const Chevron = isPrevious ? ChevronLeft : ChevronRight;
  if (!scene) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground/40',
          !compact && 'flex-1',
          isPrevious ? 'justify-start' : 'justify-end'
        )}
      >
        {isPrevious ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
        <span>{label}</span>
        {!isPrevious ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
      </span>
    );
  }
  if (compact) {
    return (
      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => onSelect({ type: 'scene', id: scene.id })}
        className='group h-auto gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/10 hover:text-primary'
      >
        {isPrevious ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
        <span>{label}</span>
        {!isPrevious ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
      </Button>
    );
  }
  return (
    <Button
      type='button'
      variant='ghost'
      onClick={() => onSelect({ type: 'scene', id: scene.id })}
      className={cn(
        'group h-auto min-w-0 flex-1 gap-3 px-3 py-2 hover:bg-primary/10',
        isPrevious ? 'justify-start' : 'justify-end text-right'
      )}
    >
      {isPrevious ? <Chevron className='h-4 w-4 shrink-0 text-primary' /> : null}
      <span className='min-w-0'>
        <span className='block text-[11px] font-semibold uppercase tracking-[0.18em] text-primary'>
          {label} scene
        </span>
        <span className='block truncate text-sm font-medium text-foreground'>
          {scene.title}
        </span>
      </span>
      {!isPrevious ? <Chevron className='h-4 w-4 shrink-0 text-primary' /> : null}
    </Button>
  );
}
