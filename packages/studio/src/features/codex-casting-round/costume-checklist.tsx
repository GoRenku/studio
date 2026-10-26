import type { CastingRound } from '@gorenku/studio-codex/casting-round';
import { castingSceneLabels, sceneSummary } from '@/features/casting-views/scene-labels';
import { Checkbox } from '@/ui/checkbox';
import { plural } from './round-subject-copy';

type CostumesSubject = Extract<CastingRound['subject'], { kind: 'costumes' }>;

/** The costumes a character sheet round covers; each ticked costume gets its own round. */
export function CostumeChecklist(input: { subject: CostumesSubject; ticked: string[]; disabled: boolean; onChange: (ticked: string[]) => void }) {
  const scenes = castingSceneLabels(input.subject.scenes);
  const toggle = (costumeId: string, checked: boolean) => input.onChange(
    input.subject.costumes.map((costume) => costume.id).filter((id) => (id === costumeId ? checked : input.ticked.includes(id))),
  );
  return (
    <fieldset className='m-0 flex flex-col gap-1.5 border-0 p-0'>
      <legend className='mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dd-muted-fg)]'>Costumes</legend>
      {input.subject.costumes.map((costume) => {
        const id = `casting-round-costume-${costume.id}`;
        return (
          <div key={costume.id} className='flex flex-wrap items-center gap-2'>
            <Checkbox id={id} checked={input.ticked.includes(costume.id)} disabled={input.disabled} onCheckedChange={(checked) => toggle(costume.id, checked === true)} />
            <label htmlFor={id} className='text-[12.5px] font-semibold'>{costume.name}</label>
            <span className='text-[12px] text-[var(--dd-muted-fg)]'>{sceneSummary(costume.sceneIds, scenes)}</span>
            <span className='ml-auto text-[12px] text-[var(--dd-muted-fg)]'>{costumeState(costume)}</span>
          </div>
        );
      })}
    </fieldset>
  );
}

function costumeState(costume: CostumesSubject['costumes'][number]): string {
  if (costume.sheetCount === 0) return 'No sheets';
  return costume.picked ? `${plural(costume.sheetCount, 'sheet')} · picked` : plural(costume.sheetCount, 'sheet');
}
