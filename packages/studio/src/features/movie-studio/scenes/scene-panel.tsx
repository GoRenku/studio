import { useEffect, useState } from 'react';
import type { Block } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import type { SceneNarrativeResourceResponse } from '@/services/studio-project-contracts';
import { readSceneNarrativeResource } from '@/services/studio-screenplay-api';
import type { StudioSelection } from '../movie-studio-selection';

interface ScenePanelProps {
  projectName: string;
  sceneId: string;
  onSelect: (selection: StudioSelection) => void;
}

export function ScenePanel({ projectName, sceneId, onSelect }: ScenePanelProps) {
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
      <TabsContent value='narrative' className='overflow-y-auto p-4'>
        <div className='mx-auto max-w-3xl space-y-5'>
          <SceneSetting resource={resource} onSelect={onSelect} />
          <div className='space-y-4 rounded-md border border-border/40 bg-card p-5'>
            {resource.blocks.map((block, index) => (
              <SceneBlock
                key={`${block.type}-${index}`}
                block={block}
                resource={resource}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </TabsContent>
      <TabsContent value='shots' className='p-4 text-sm text-muted-foreground'>
        Scene shots will appear here when a shot model is added.
      </TabsContent>
    </Tabs>
  );
}

function SceneSetting({
  resource,
  onSelect,
}: {
  resource: SceneNarrativeResourceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  const locationIds = resource.scene.setting.locationIds ?? [];
  return (
    <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
      {[resource.scene.setting.interiorExterior, resource.scene.setting.timeOfDay]
        .filter(Boolean)
        .map((label) => (
          <span key={label} className='rounded-sm bg-muted px-2 py-1'>
            {label}
          </span>
        ))}
      {locationIds.map((locationId) => (
        <Button
          key={locationId}
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => onSelect({ type: 'location', id: locationId })}
        >
          {resource.locationLabels[locationId] ?? locationId}
        </Button>
      ))}
    </div>
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
    const castMemberId = block.castMemberId;
    return (
      <div className='mx-auto max-w-xl space-y-2'>
        <div className='text-center text-sm font-semibold uppercase tracking-[0.08em]'>
          {castMemberId ? (
            <Button
              type='button'
              variant='link'
              className='h-auto p-0 text-sm font-semibold uppercase tracking-[0.08em]'
              onClick={() => onSelect({ type: 'castMember', id: castMemberId })}
            >
              {resource.castMemberLabels[castMemberId] ?? castMemberId}
            </Button>
          ) : (
            block.castMemberReference?.key ?? 'Dialogue'
          )}
          {block.extension ? <span> ({block.extension})</span> : null}
        </div>
        {block.parenthetical ? (
          <div className='text-center text-sm text-muted-foreground'>
            ({block.parenthetical})
          </div>
        ) : null}
        <div className='space-y-1 text-sm leading-6'>
          {block.lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <ReferenceChips block={block} resource={resource} onSelect={onSelect} />
      </div>
    );
  }

  const tone =
    block.type === 'transition'
      ? 'text-right uppercase tracking-[0.08em] font-semibold'
      : block.type === 'shot' || block.type === 'special_heading'
        ? 'uppercase tracking-[0.08em] font-semibold'
        : block.type === 'note'
          ? 'rounded-md bg-muted p-3 text-muted-foreground'
          : '';

  return (
    <div className='space-y-2'>
      <p className={`whitespace-pre-wrap text-sm leading-6 ${tone}`}>{block.text}</p>
      <ReferenceChips block={block} resource={resource} onSelect={onSelect} />
    </div>
  );
}

function ReferenceChips({
  block,
  resource,
  onSelect,
}: {
  block: Block;
  resource: SceneNarrativeResourceResponse;
  onSelect: (selection: StudioSelection) => void;
}) {
  const castIds = [
    ...(block.castMemberIds ?? []),
    ...(block.type === 'dialogue' && block.castMemberId ? [block.castMemberId] : []),
  ];
  const locationIds = block.locationIds ?? [];
  if (!castIds.length && !locationIds.length) {
    return null;
  }
  return (
    <div className='flex flex-wrap gap-2'>
      {Array.from(new Set(castIds)).map((castMemberId) => (
        <Button
          key={castMemberId}
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => onSelect({ type: 'castMember', id: castMemberId })}
        >
          {resource.castMemberLabels[castMemberId] ?? castMemberId}
        </Button>
      ))}
      {Array.from(new Set(locationIds)).map((locationId) => (
        <Button
          key={locationId}
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => onSelect({ type: 'location', id: locationId })}
        >
          {resource.locationLabels[locationId] ?? locationId}
        </Button>
      ))}
    </div>
  );
}
