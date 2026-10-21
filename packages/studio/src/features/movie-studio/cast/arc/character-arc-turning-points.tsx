import type { CastMemberCharacterArcResourceResponse } from '@/services/studio-project-contracts';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';
import { groupTurningPointsByAct } from './character-arc-timeline-model';
import { SceneChips } from './scene-chips';

/** One card per turning point in a single sideways-scrolling row, grouped by act. */
export function CharacterArcTurningPoints({
  projectName,
  resource,
}: {
  projectName: string;
  resource: CastMemberCharacterArcResourceResponse;
}) {
  const looks = new Map(resource.looks.map((look) => [look.id, look]));
  const { ends, turningPoints } = resource.arc;
  return (
    <div className='mt-6 flex gap-[22px] overflow-x-auto pb-4 pt-1'>
      {groupTurningPointsByAct(resource).map((group, groupIndex) => (
        <section key={`${group.label}-${groupIndex}`} className='flex-none'>
          {group.label ? (
            <h2 className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary'>{group.label}</h2>
          ) : null}
          <div className='flex gap-2.5'>
            {group.cards.map((card) => {
              const point = turningPoints[card.turningPointIndex]!;
              const look = point.lookAssetFileId ? looks.get(point.lookAssetFileId) : undefined;
              return (
                <article key={card.number} className='flex w-[228px] flex-none flex-col overflow-hidden rounded-[10px] border border-border/40 bg-muted/30'>
                  {look ? (
                    <>
                      <div className='aspect-video bg-white/90'>
                        <img src={projectAssetFileUrl(projectName, look.id)} alt={look.title ?? ''} className='h-full w-full object-contain' />
                      </div>
                      {look.title ? <p className='px-3 pt-1.5 text-[11px] text-muted-foreground'>{look.title}</p> : null}
                    </>
                  ) : null}
                  <div className='flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-2.5'>
                    <div className='flex items-center gap-1.5'>
                      <span className='grid h-[22px] w-[22px] place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground'>
                        {card.number}
                      </span>
                      <SceneChips sceneIds={point.sceneIds} scenes={resource.scenes} range />
                    </div>
                    <h3 className='text-sm font-bold leading-snug'>{point.label}</h3>
                    <p className='text-[12.5px] leading-normal text-foreground/85'>{point.state}</p>
                    {point.quote ? <q className='text-xs italic text-foreground'>{point.quote}</q> : null}
                    {card.shift ? (
                      <p className={card.shift === 'up' ? 'text-[11px] font-bold text-emerald-300/90' : 'text-[11px] font-bold text-rose-300/90'}>
                        {card.shift === 'up' ? '▲' : '▼'} turns toward “{card.shift === 'up' ? ends.high : ends.low}”
                      </p>
                    ) : null}
                    <div className='mt-auto pt-2'>
                      <div className='relative h-1 rounded-sm bg-gradient-to-r from-rose-400/60 via-muted-foreground/40 to-emerald-400/60'>
                        <span
                          className='absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel-bg bg-foreground'
                          style={{ left: `${(point.position + 5) * 10}%` }}
                        />
                      </div>
                      <div className='mt-1.5 flex justify-between gap-2 text-[10px] text-muted-foreground'>
                        <span>{ends.low}</span>
                        <span className='text-right'>{ends.high}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
