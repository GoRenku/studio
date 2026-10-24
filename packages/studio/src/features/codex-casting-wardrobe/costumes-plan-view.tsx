import { useState } from 'react';
import type { CastingCostumesPanel } from '@gorenku/studio-codex/casting-wardrobe';
import { CASTING_TONE_CLASS_NAMES, castingLookTone } from '@/features/casting-views/casting-tones';
import { SceneStrip } from '@/features/casting-views/scene-strip';
import { castingSceneLabels, sceneSummary } from '@/features/casting-views/scene-labels';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { coveredSceneCount, cycleScene, sceneChanges, sceneOwners } from './wardrobe-edits';
import type { WardrobeViewProps } from './wardrobe-view-props';

const COSTUME_BAND = 'Costume';

export function CostumesPlanView(input: WardrobeViewProps<CastingCostumesPanel>) {
  const { panel, disabled } = input;
  const [costumes, setCostumes] = useState(panel.draft.costumes);
  const scenes = castingSceneLabels(panel.scenes);
  const lookOwners = sceneOwners(panel.looks);
  const changes = sceneChanges(panel.draft.costumes, costumes, scenes, 'no costume');
  const covered = coveredSceneCount(costumes);

  /** A costume cell cycles through the costumes of that scene's Look. */
  const moveScene = (band: string, sceneId: string) => {
    if (band !== COSTUME_BAND) return;
    const lookIndex = lookOwners.get(sceneId);
    const lookId = lookIndex === undefined ? undefined : panel.looks[lookIndex]!.id;
    const allowed = costumes.flatMap((costume, index) => costume.lookId === lookId ? [index] : []);
    setCostumes(cycleScene(costumes, allowed, sceneId, scenes));
  };
  const summary = `${costumes.length} ${costumes.length === 1 ? 'costume' : 'costumes'} over ${covered} ${covered === 1 ? 'scene' : 'scenes'} · ${changes}`;

  return (
    <section aria-label='Wardrobe plan' className='image-edit overflow-hidden rounded-xl border border-[var(--dd-border)]'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>Wardrobe plan</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{panel.castMember.name} · {costumes.length} {costumes.length === 1 ? 'costume' : 'costumes'} · {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}</span>
        <span className='ml-auto text-xs text-[var(--dd-muted-fg)]'>Click a costume cell to change it</span>
      </header>
      {input.notice}
      <div className='flex flex-col gap-3.5 px-[18px] pb-4 pt-1'>
        <SceneStrip
          scenes={scenes}
          bands={[
            { label: 'Look', rows: panel.looks.map((look, index) => ({ sceneIds: look.sceneIds, name: look.name, tone: castingLookTone(index) })) },
            { label: COSTUME_BAND, rows: costumes.map((costume) => ({ sceneIds: costume.sceneIds, name: costume.name, tone: 'costume' as const })) },
          ]}
          onSceneClick={disabled ? undefined : moveScene}
        />
        <ul aria-label='Costumes' className='m-0 flex list-none flex-col gap-1.5 p-0'>
          {costumes.map((costume) => {
            const lookIndex = panel.looks.findIndex((look) => look.id === costume.lookId);
            const savedPick = costume.id !== undefined && panel.sheetPickedCostumeIds.includes(costume.id);
            return (
              <li key={costume.id ?? costume.name} className='grid grid-cols-[10px_180px_minmax(0,1fr)_auto] items-start gap-3 rounded-[10px] border border-[var(--dd-border)] bg-[var(--dd-card)] px-3 py-2 text-[12px]'>
                <span aria-hidden className={cn('mt-1 size-2.5 rounded-full', lookIndex >= 0 ? CASTING_TONE_CLASS_NAMES[castingLookTone(lookIndex)] : 'bg-[var(--dd-muted)]')} />
                <div className='flex flex-col'>
                  <b className='text-[12.5px]'>{costume.name}</b>
                  <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>{sceneSummary(costume.sceneIds, scenes)}</span>
                </div>
                <span>{costume.wardrobe.join(' ')}</span>
                <span className='rounded-full border border-[var(--dd-border)] px-2 py-px text-[11px] text-[var(--dd-muted-fg)]'>{savedPick ? 'Sheet picked' : 'No sheet yet'}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <footer className='flex flex-wrap items-center gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <span className='min-w-0 flex-1 text-[11.5px] text-[var(--dd-muted-fg)]'>{changes === 'no changes' ? 'To add, rename or split a costume, tell the agent.' : `You made ${changes}.`}</span>
        <Button type='button' variant='outline' size='sm' disabled={disabled} onClick={() => input.respond({ kind: 'canceled' }, '')}>Cancel</Button>
        <Button
          type='button'
          size='sm'
          disabled={disabled}
          onClick={() => input.respond({ kind: 'send', draft: { ...panel.draft, costumes } }, summary)}
          className='bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105'
        >
          Send plan to agent
        </Button>
      </footer>
    </section>
  );
}
