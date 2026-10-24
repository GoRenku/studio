import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import { cn } from '@/lib/utils';
import { AgentRequestHint } from '@/ui/agent-request';
import { Button } from '@/ui/button';
import type { CastCastingResourceResponse } from '@/services/studio-project-contracts';
import { costumeCharacterSheetsRequest, planWardrobeRequest } from '../../agent-request-copy';
import { sceneSummary } from '@/features/casting-views/scene-labels';
import { CastingSectionHeading } from './casting-section-heading';

interface CostumeSheetsProps {
  resource: CastCastingResourceResponse;
  scenes: SceneStripScene[];
  pendingAssetFileId: string | null;
  onPick: (costumeId: string, assetFileId: string) => void;
}

/** One row per costume with every Character Sheet of the Cast Member; clicking a sheet picks it for that costume. */
export function CostumeSheets({ resource, scenes, pendingAssetFileId, onPick }: CostumeSheetsProps) {
  const castMemberName = resource.castMember.name;
  const lookNames = new Map(resource.looks.map((look) => [look.id, look.name]));
  return (
    <section className='mt-8'>
      <CastingSectionHeading>Character sheets</CastingSectionHeading>
      {resource.costumes.length === 0 ? (
        <AgentRequestHint request={planWardrobeRequest(castMemberName)} className='mt-3' />
      ) : (
        <>
          {resource.characterSheets.length === 0 ? (
            <AgentRequestHint request={costumeCharacterSheetsRequest(castMemberName)} className='mt-3' />
          ) : null}
          <div className='mt-2'>
            {resource.costumes.map((costume) => (
              <div
                key={costume.id}
                className='grid grid-cols-[180px_minmax(0,1fr)] items-start gap-3.5 border-t border-border/40 py-3 first:border-t-0'
              >
                <div className='flex flex-col gap-1 text-[11.5px] text-muted-foreground'>
                  <h3 className='text-[12.5px] font-bold text-foreground'>{costume.name}</h3>
                  <span>{sceneSummary(costume.sceneIds, scenes)}</span>
                  {lookNames.has(costume.lookId) ? <span>{lookNames.get(costume.lookId)} look</span> : null}
                </div>
                {resource.characterSheets.length > 0 ? (
                  <div className='grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5'>
                    {resource.characterSheets.map((sheet) => {
                      const picked = sheet.id === costume.characterSheetAssetFileId;
                      return (
                        <Button
                          key={sheet.id}
                          type='button'
                          variant='ghost'
                          aria-pressed={picked}
                          aria-label={`${picked ? 'Picked' : 'Pick'} for ${costume.name}: ${sheet.title ?? 'character sheet'}`}
                          disabled={pendingAssetFileId === sheet.id}
                          className={cn(
                            'relative block aspect-[4/3] h-auto overflow-hidden rounded-lg border border-border/40 bg-white/90 p-0 hover:bg-white/90 hover:ring-2 hover:ring-primary/50',
                            picked ? 'outline-2 -outline-offset-2 outline-take-shot-selected-border' : null
                          )}
                          onClick={() => {
                            if (!picked) {
                              onPick(costume.id, sheet.id);
                            }
                          }}
                        >
                          <img src={sheet.url} alt='' className='h-full w-full object-contain' />
                          {picked ? (
                            <span className='absolute right-1.5 top-1.5 rounded-full border border-take-shot-selected-border bg-take-shot-selected-bg px-2 py-px text-[10.5px] font-bold text-foreground'>
                              Picked
                            </span>
                          ) : null}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <span className='text-[11.5px] text-muted-foreground'>No sheet yet</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
