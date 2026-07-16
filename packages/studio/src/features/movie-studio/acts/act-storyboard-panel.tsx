import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type {
  ActStoryboardResourceResponse,
  ActStoryboardSequenceResponse,
  ActStoryboardBeatResponse,
} from '@/services/studio-project-contracts';
import { readActStoryboardResource } from '@/services/studio-screenplay-api';
import {
  matchesActStoryboardResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import type { StudioSelection } from '../movie-studio-selection';
import { ACT_STORYBOARD_LAYOUT } from './act-storyboard-layout';

interface ActStoryboardPanelProps {
  projectName: string;
  actId: string;
  onSelect: (selection: StudioSelection) => void;
}

export function ActStoryboardPanel({
  projectName,
  actId,
  onSelect,
}: ActStoryboardPanelProps) {
  const [resource, setResource] =
    useState<ActStoryboardResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readActStoryboardResource(projectName, actId)
      .then((nextResource) => {
        if (!cancelled) setResource(nextResource);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Unable to load act.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, actId, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    enabled: Boolean(resource),
    matches: (resourceKeys) =>
      matchesActStoryboardResource({
        resourceKeys,
        actId,
        sequenceIds: new Set(
          resource?.sequences.map((sequence) => sequence.sequence.id) ?? []
        ),
        sceneIds: new Set(
          resource?.sequences.flatMap((sequence) =>
            sequence.scenes.map((scene) => scene.scene.id)
          ) ?? []
        ),
      }),
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  if (error) {
    return (
      <div className='min-h-full bg-panel-bg p-5 sm:p-8 lg:p-10'>
        <p className='text-sm text-destructive'>{error}</p>
      </div>
    );
  }
  if (!resource) {
    return (
      <div className='min-h-full bg-panel-bg p-5 sm:p-8 lg:p-10'>
        <p className='text-sm text-muted-foreground'>Loading act...</p>
      </div>
    );
  }

  return (
    <div className='min-h-full overflow-y-auto bg-panel-bg p-5 sm:p-8 lg:p-10'>
      <div className='mx-auto max-w-[1240px] space-y-10'>
        {resource.act.purpose ? (
          <p className='max-w-3xl text-sm leading-6 text-muted-foreground'>
            {resource.act.purpose}
          </p>
        ) : null}
        {resource.sequences.map((sequence) => (
          <SequenceSection
            key={sequence.sequence.id}
            sequence={sequence}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function SequenceSection({
  sequence,
  onSelect,
}: {
  sequence: ActStoryboardSequenceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  const beatCount = sequence.scenes.reduce(
    (total, scene) => total + scene.beats.length,
    0
  );
  return (
    <section className='space-y-5'>
      <div className='flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-3'>
        <Button
          type='button'
          variant='link'
          onClick={() => onSelect({ type: 'sequence', id: sequence.sequence.id })}
          className='h-auto p-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground'
        >
          {sequence.sequence.title}
        </Button>
        <span className='rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground/70'>
          {sequence.scenes.length} scenes · {beatCount} beats
        </span>
      </div>
      <div className='space-y-6'>
        {sequence.scenes.map((scene) => (
          <SceneCluster
            key={scene.scene.id}
            scene={scene}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function SceneCluster({
  scene,
  onSelect,
}: {
  scene: ActStoryboardSequenceResponse['scenes'][number];
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <div className='space-y-2'>
      <Button
        type='button'
        variant='link'
        onClick={() => onSelect({ type: 'scene', id: scene.scene.id })}
        className='h-auto p-0 text-sm font-medium text-foreground/80 hover:text-primary'
      >
        {scene.scene.title}
      </Button>
      {scene.beats.length ? (
        <div
          className={cn('grid', ACT_STORYBOARD_LAYOUT.shotGapClass)}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${ACT_STORYBOARD_LAYOUT.shotMinWidthPx}px, 1fr))`,
          }}
        >
          {scene.beats.map((beat) => (
            <BeatThumbnail
              key={beat.beatId}
              sceneId={scene.scene.id}
              beat={beat}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <ScenePlaceholderSlot
          sceneId={scene.scene.id}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function BeatThumbnail({
  sceneId,
  beat,
  onSelect,
}: {
  sceneId: string;
  beat: ActStoryboardBeatResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      onClick={() =>
        onSelect({
          type: 'scene',
          id: sceneId,
          sceneTab: 'beats',
          beatId: beat.beatId,
        })
      }
      aria-label={`${beat.label} — ${beat.title}`}
      className='group h-auto min-w-0 flex-col items-stretch gap-1.5 overflow-hidden rounded-md border border-border/40 bg-card p-0 text-left hover:border-item-active-border hover:bg-card'
    >
      <span className='aspect-[4/3] w-full overflow-hidden bg-muted'>
        {beat.image ? (
          <img
            src={beat.image.url}
            alt={`${beat.label} — ${beat.title}`}
            className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]'
          />
        ) : (
          <span className='flex h-full items-center justify-center text-muted-foreground'>
            <ImageOff className='h-4 w-4' />
          </span>
        )}
      </span>
      <span className='flex w-full flex-col gap-0.5 px-2 pb-2'>
        <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          {beat.label}
        </span>
        <span className='truncate text-xs text-foreground/85'>{beat.title}</span>
      </span>
    </Button>
  );
}

function ScenePlaceholderSlot({
  sceneId,
  onSelect,
}: {
  sceneId: string;
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      onClick={() => onSelect({ type: 'scene', id: sceneId })}
      aria-label='Open scene beats'
      className='flex h-auto items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/15 px-4 py-6 text-center hover:border-item-active-border hover:bg-muted/15'
      style={{ maxWidth: `${ACT_STORYBOARD_LAYOUT.sceneSlotMinWidthPx}px` }}
    >
      <span className='inline-flex items-center gap-2 text-xs text-muted-foreground'>
        <ImageOff className='h-4 w-4' />
        No storyboard yet
      </span>
    </Button>
  );
}
