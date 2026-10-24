import { useState } from 'react';
import type { CastingLooksPanel } from '@gorenku/studio-codex/casting-wardrobe';
import { castingLookTone } from '@/features/casting-views/casting-tones';
import { LookCard } from '@/features/casting-views/look-card';
import { SceneStrip } from '@/features/casting-views/scene-strip';
import { usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { castingSceneLabels, sceneSummary } from '@/features/casting-views/scene-labels';
import { Button } from '@/ui/button';
import { cycleScene, groupsSummary, sceneChanges } from './wardrobe-edits';
import type { WardrobeViewProps } from './wardrobe-view-props';

export function LooksPlanView(input: WardrobeViewProps<CastingLooksPanel>) {
  const { panel, disabled } = input;
  const [looks, setLooks] = useState(panel.draft.looks);
  const scenes = castingSceneLabels(panel.scenes);
  const changes = sceneChanges(panel.draft.looks, looks, scenes, 'no Look');
  const allLooks = looks.map((_, index) => index);

  return (
    <section aria-label='Looks' className='image-edit overflow-hidden rounded-xl border border-[var(--dd-border)]'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>Looks for {panel.castMember.name}</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}</span>
        <span className='ml-auto text-xs text-[var(--dd-muted-fg)]'>Click a scene to move it to another Look</span>
      </header>
      {input.notice}
      <div className='flex flex-col gap-3.5 px-[18px] pb-4 pt-1'>
        <SceneStrip
          scenes={scenes}
          bands={[{ label: 'Look', rows: looks.map((look, index) => ({ sceneIds: look.sceneIds, name: look.name, tone: castingLookTone(index) })) }]}
          onSceneClick={disabled ? undefined : (_band, sceneId) => setLooks(cycleScene(looks, allLooks, sceneId, scenes))}
        />
        <div className='flex flex-wrap gap-2.5'>
          {looks.map((look, index) => (
            <DraftLookCard key={look.id ?? look.name} look={look} index={index} castImageUri={panel.looks.find((saved) => saved.id === look.id)?.castImageUri ?? null} summary={sceneSummary(look.sceneIds, scenes)} media={input.media} />
          ))}
        </div>
      </div>
      <footer className='flex flex-wrap items-center gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <span className='min-w-0 flex-1 text-[11.5px] text-[var(--dd-muted-fg)]'>{changes === 'no changes' ? 'To add, rename or split a Look, tell the agent.' : `You made ${changes}.`}</span>
        <Button type='button' variant='outline' size='sm' disabled={disabled} onClick={() => input.respond({ kind: 'canceled' }, '')}>Cancel</Button>
        <Button
          type='button'
          size='sm'
          disabled={disabled}
          onClick={() => input.respond({ kind: 'send', draft: { ...panel.draft, looks } }, groupsSummary(looks, scenes))}
          className='bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105'
        >
          Use these Looks
        </Button>
      </footer>
    </section>
  );
}

function DraftLookCard(input: { look: CastingLooksPanel['draft']['looks'][number]; index: number; castImageUri: string | null; summary: string; media: PanelMediaLibrary }) {
  const { url } = usePanelMediaUrl(input.media, input.castImageUri);
  return (
    <LookCard
      name={input.look.name}
      sceneSummary={input.summary}
      imageUrl={url ?? null}
      tone={castingLookTone(input.index)}
      details={input.look.description ? [input.look.description] : []}
    />
  );
}
