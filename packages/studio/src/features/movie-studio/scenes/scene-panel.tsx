import { useEffect, useState, type ReactNode } from 'react';
import type { Block } from '@gorenku/studio-core/client';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CloudMoon,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Trees,
  type LucideIcon,
} from 'lucide-react';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import { cn } from '@/lib/utils';
import type { SceneNarrativeResourceResponse } from '@/services/studio-project-contracts';
import { readSceneNarrativeResource } from '@/services/studio-screenplay-api';
import type { StudioSelection } from '../movie-studio-selection';

interface SceneNeighbor {
  id: string;
  title: string;
}

interface ScenePanelProps {
  projectName: string;
  sceneId: string;
  onSelect: (selection: StudioSelection) => void;
  previousScene?: SceneNeighbor | null;
  nextScene?: SceneNeighbor | null;
}

type ReferenceKind = 'castMember' | 'location';

export function ScenePanel({
  projectName,
  sceneId,
  onSelect,
  previousScene,
  nextScene,
}: ScenePanelProps) {
  const [resource, setResource] = useState<SceneNarrativeResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readSceneNarrativeResource(projectName, sceneId)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load scene.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId]);

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading scene...</p>;
  }

  return (
    <Tabs defaultValue='narrative' className='h-full gap-0'>
      <LineTabBar
        items={[
          { value: 'narrative', label: 'Narrative' },
          { value: 'shots', label: 'Shots' },
        ]}
      />
      <TabsContent value='narrative' className='overflow-y-auto px-6 py-10 sm:px-10'>
        <article className='mx-auto max-w-2xl text-foreground'>
          <SceneNav
            previousScene={previousScene}
            nextScene={nextScene}
            onSelect={onSelect}
            placement='top'
          />
          <SlugLine resource={resource} onSelect={onSelect} />
          <div className='mt-10 space-y-7 text-[15.5px] leading-7'>
            {resource.blocks.map((block, index) => (
              <SceneBlock
                key={`${block.type}-${index}`}
                block={block}
                resource={resource}
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
      </TabsContent>
      <TabsContent value='shots' className='p-4 text-sm text-muted-foreground'>
        Scene shots will appear here when a shot model is added.
      </TabsContent>
    </Tabs>
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
  const isPrev = direction === 'prev';
  const label = isPrev ? 'Previous' : 'Next';
  const Chevron = isPrev ? ChevronLeft : ChevronRight;
  if (!scene) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground/40',
          !compact && 'flex-1',
          isPrev ? 'justify-start' : 'justify-end'
        )}
      >
        {isPrev ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
        <span>{label}</span>
        {!isPrev ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
      </span>
    );
  }
  if (compact) {
    return (
      <button
        type='button'
        onClick={() => onSelect({ type: 'scene', id: scene.id })}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/10',
          isPrev ? 'justify-self-start' : 'justify-self-end'
        )}
      >
        {isPrev ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
        <span>{label}</span>
        {!isPrev ? <Chevron className='h-3.5 w-3.5 shrink-0' /> : null}
      </button>
    );
  }
  return (
    <button
      type='button'
      onClick={() => onSelect({ type: 'scene', id: scene.id })}
      className={cn(
        'group flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-primary/10',
        isPrev ? 'justify-start' : 'justify-end text-right'
      )}
    >
      {isPrev ? (
        <Chevron className='h-4 w-4 shrink-0 text-primary' />
      ) : null}
      <span className='min-w-0'>
        <span className='block text-[11px] font-semibold uppercase tracking-[0.18em] text-primary'>
          {label} scene
        </span>
        <span className='block truncate text-sm font-medium text-foreground'>
          {scene.title}
        </span>
      </span>
      {!isPrev ? (
        <Chevron className='h-4 w-4 shrink-0 text-primary' />
      ) : null}
    </button>
  );
}

function SlugLine({
  resource,
  onSelect,
}: {
  resource: SceneNarrativeResourceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  const setting = resource.scene.setting;
  const interiorExterior = setting.interiorExterior?.trim() ?? '';
  const timeOfDay = setting.timeOfDay?.trim() ?? '';
  const locationIds = setting.locationIds ?? [];

  const InteriorIcon = pickInteriorIcon(interiorExterior);
  const TimeIcon = pickTimeIcon(timeOfDay);

  const hasInteriorExterior = Boolean(interiorExterior);
  const hasLocations = locationIds.length > 0;
  const hasTime = Boolean(timeOfDay);

  return (
    <header className='font-mono text-[12.5px] uppercase tracking-[0.16em] text-muted-foreground'>
      <div className='flex flex-wrap items-center gap-x-1.5 gap-y-1'>
        {hasInteriorExterior ? (
          <span className='inline-flex items-center gap-1.5'>
            {InteriorIcon ? (
              <InteriorIcon className='h-3 w-3 opacity-70' aria-hidden />
            ) : null}
            <span>{interiorExterior}.</span>
          </span>
        ) : null}
        {hasLocations
          ? locationIds.map((locationId, index) => (
              <span key={locationId} className='inline-flex items-center'>
                <button
                  type='button'
                  onClick={() => onSelect({ type: 'location', id: locationId })}
                  className='font-medium text-foreground/85 underline-offset-4 transition-colors hover:text-primary hover:underline'
                >
                  {resource.locationLabels[locationId] ?? locationId}
                </button>
                {index < locationIds.length - 1 ? (
                  <span aria-hidden>,</span>
                ) : null}
              </span>
            ))
          : null}
        {hasTime ? (
          <span className='inline-flex items-center gap-1.5'>
            <span aria-hidden className='text-muted-foreground/50'>
              {hasInteriorExterior || hasLocations ? '—' : ''}
            </span>
            {TimeIcon ? (
              <TimeIcon className='h-3 w-3 opacity-70' aria-hidden />
            ) : null}
            <span>{timeOfDay}</span>
          </span>
        ) : null}
      </div>
    </header>
  );
}

function SceneBlock({
  block,
  resource,
  onSelect,
}: {
  block: Block;
  resource: SceneNarrativeResourceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  if (block.type === 'dialogue') {
    return <DialogueBlockView block={block} resource={resource} onSelect={onSelect} />;
  }

  return <TextBlockView block={block} resource={resource} onSelect={onSelect} />;
}

function DialogueBlockView({
  block,
  resource,
  onSelect,
}: {
  block: Extract<Block, { type: 'dialogue' }>;
  resource: SceneNarrativeResourceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  const castMemberId = block.castMemberId;
  const fallbackName = block.castMemberReference?.key ?? 'Dialogue';
  const characterName = castMemberId
    ? resource.castMemberLabels[castMemberId] ?? fallbackName
    : fallbackName;

  return (
    <div className='mx-auto max-w-[28rem] rounded-lg bg-foreground/[0.035] px-6 py-4 dark:bg-muted/30'>
      <div className='text-center text-[12.5px] font-semibold uppercase tracking-[0.18em] text-primary'>
        {castMemberId ? (
          <button
            type='button'
            onClick={() => onSelect({ type: 'castMember', id: castMemberId })}
            className='underline-offset-4 transition-colors hover:text-foreground hover:underline'
          >
            {characterName}
          </button>
        ) : (
          <span>{characterName}</span>
        )}
        {block.extension ? (
          <span className='ml-1 font-normal text-muted-foreground'>
            ({block.extension})
          </span>
        ) : null}
      </div>
      {block.parenthetical ? (
        <div className='mt-1 text-center text-[13px] italic text-muted-foreground'>
          ({block.parenthetical})
        </div>
      ) : null}
      <div className='mt-2 space-y-2 text-[15px] leading-7 text-foreground/95'>
        {block.lines.map((line, index) => (
          <p key={index}>
            <InlineText text={line} resource={resource} onSelect={onSelect} />
          </p>
        ))}
      </div>
    </div>
  );
}

function TextBlockView({
  block,
  resource,
  onSelect,
}: {
  block: Exclude<Block, { type: 'dialogue' }>;
  resource: SceneNarrativeResourceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  if (block.type === 'transition') {
    return (
      <p className='pt-2 text-right text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
        {block.text}
      </p>
    );
  }

  if (block.type === 'shot' || block.type === 'special_heading') {
    return (
      <p className='pt-1 font-mono text-[12.5px] font-semibold uppercase tracking-[0.16em] text-foreground'>
        <InlineText text={block.text} resource={resource} onSelect={onSelect} />
      </p>
    );
  }

  if (block.type === 'title_card' || block.type === 'super') {
    return (
      <p className='text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-foreground'>
        <InlineText text={block.text} resource={resource} onSelect={onSelect} />
      </p>
    );
  }

  if (block.type === 'note') {
    return (
      <p className='border-l-2 border-primary/40 pl-3 text-[13.5px] italic text-muted-foreground'>
        <InlineText text={block.text} resource={resource} onSelect={onSelect} />
      </p>
    );
  }

  return (
    <p className='whitespace-pre-wrap'>
      <InlineText text={block.text} resource={resource} onSelect={onSelect} />
    </p>
  );
}

const HANDLE_PATTERN = /@([a-zA-Z0-9][a-zA-Z0-9_-]*)/g;

function InlineText({
  text,
  resource,
  onSelect,
}: {
  text: string;
  resource: SceneNarrativeResourceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  HANDLE_PATTERN.lastIndex = 0;
  let key = 0;
  while ((match = HANDLE_PATTERN.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) {
      nodes.push(<span key={`t${key++}`}>{text.slice(lastIndex, start)}</span>);
    }
    const handle = match[1].toLowerCase();
    const entity = resolveHandle(handle, resource);
    if (entity) {
      nodes.push(
        <button
          key={`l${key++}`}
          type='button'
          onClick={() => onSelect({ type: entity.kind, id: entity.id })}
          className='font-semibold text-primary underline decoration-primary/40 decoration-1 underline-offset-[3px] transition-colors hover:decoration-primary'
        >
          {entity.label}
        </button>
      );
    } else {
      nodes.push(
        <span key={`u${key++}`} className='text-muted-foreground'>
          {match[0]}
        </span>
      );
    }
    lastIndex = end;
  }
  if (lastIndex < text.length) {
    nodes.push(<span key={`t${key++}`}>{text.slice(lastIndex)}</span>);
  }
  return <>{nodes}</>;
}

function resolveHandle(
  handle: string,
  resource: SceneNarrativeResourceResponse
): { kind: ReferenceKind; id: string; label: string } | null {
  const castId = resource.castMemberHandles?.[handle];
  if (castId) {
    return {
      kind: 'castMember',
      id: castId,
      label: resource.castMemberLabels[castId] ?? handle,
    };
  }
  const locationId = resource.locationHandles?.[handle];
  if (locationId) {
    return {
      kind: 'location',
      id: locationId,
      label: resource.locationLabels[locationId] ?? handle,
    };
  }
  return null;
}

function pickInteriorIcon(value: string): LucideIcon | null {
  const v = value.toLowerCase();
  if (!v) return null;
  if (v.startsWith('ext')) return Trees;
  if (v.startsWith('int')) return Building2;
  return null;
}

function pickTimeIcon(value: string): LucideIcon | null {
  const v = value.toLowerCase();
  if (!v) return null;
  if (v.includes('dawn')) return Sunrise;
  if (v.includes('dusk') || v.includes('sunset')) return Sunset;
  if (v.includes('night')) return Moon;
  if (v.includes('evening')) return CloudMoon;
  if (v.includes('morning') || v.includes('day') || v.includes('noon') || v.includes('afternoon'))
    return Sun;
  return Sun;
}
