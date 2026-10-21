import { ArrowRight } from 'lucide-react';
import type { CastMemberCharacterArcResourceResponse } from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { ARC_TYPE_HINTS, ARC_TYPE_LABELS, SPINE_LABELS, SPINE_ORDER } from './character-arc-copy';
import { SceneChips } from './scene-chips';

export function CharacterArcSummary({
  resource,
  onOpenCastMember,
}: {
  resource: CastMemberCharacterArcResourceResponse;
  onOpenCastMember: (castMemberId: string) => void;
}) {
  const { arc } = resource;
  const spineKeys = SPINE_ORDER[arc.arcType].filter((key) => arc.spine[key]);
  return (
    <header>
      {resource.sharedWith ? (
        <p className='mb-3.5 rounded-lg bg-muted/40 px-3.5 py-2.5 text-[13.5px] text-foreground/85'>
          Shared with{' '}
          <Button
            type='button'
            variant='link'
            className='h-auto p-0 text-[13.5px] font-bold text-primary'
            onClick={() => onOpenCastMember(resource.sharedWith!.ownerCastMemberId)}
          >
            {resource.sharedWith.ownerName}
          </Button>
          . This is {resource.sharedWith.ownerName}&apos;s arc.
        </p>
      ) : null}
      <div className='flex flex-wrap items-center gap-3.5'>
        <h1 className='text-[30px] font-extrabold leading-tight tracking-[-0.01em]'>{resource.castMember.name}</h1>
        {resource.castMember.role ? (
          <span className='text-sm text-muted-foreground'>{resource.castMember.role}</span>
        ) : null}
        <span
          className='rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground'
          title={ARC_TYPE_HINTS[arc.arcType]}
        >
          {ARC_TYPE_LABELS[arc.arcType]}
        </span>
        <span className='rounded-full border border-sky-300/35 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-sky-300/90'>
          Interpretation
        </span>
        {resource.freshness === 'needsRefresh' ? (
          <span
            className='rounded-full border border-amber-400/50 px-2.5 py-0.5 text-[11px] font-bold text-amber-300'
            title={resource.freshnessHelp ?? undefined}
          >
            Needs refresh
          </span>
        ) : null}
      </div>
      <div className='mt-5 grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)]'>
        <ArcEnd label='Starts' text={arc.startState} />
        <div className='grid place-items-center text-primary'>
          <ArrowRight className='h-5 w-5' />
        </div>
        <ArcEnd label='Ends' text={arc.endState} />
      </div>
      <dl className='mt-4 grid grid-cols-4 border-t border-border/40'>
        {spineKeys.map((key, index) => {
          const field = arc.spine[key]!;
          return (
            <div key={key} className={index === 0 ? 'pb-1 pr-[18px] pt-3.5' : 'border-l border-border/40 px-[18px] pb-1 pt-3.5'}>
              <dt className='text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground'>{SPINE_LABELS[key]}</dt>
              <dd className='mb-2 mt-1.5 text-[13.5px] leading-normal text-foreground/85'>{field.text}</dd>
              <dd><SceneChips sceneIds={field.sceneIds} scenes={resource.scenes} /></dd>
            </div>
          );
        })}
      </dl>
    </header>
  );
}

function ArcEnd({ label, text }: { label: string; text: string }) {
  return (
    <div className='rounded-[10px] border border-border/40 bg-muted/30 px-[18px] py-3.5'>
      <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground'>{label}</p>
      <p className='mt-1.5 text-base font-medium leading-normal text-foreground'>{text}</p>
    </div>
  );
}
