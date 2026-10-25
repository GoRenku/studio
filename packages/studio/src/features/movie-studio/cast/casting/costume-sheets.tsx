import { useState } from 'react';
import { ExpandSheetButton, PickSheetAction } from '@/features/casting-views/sheet-actions';
import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import { cn } from '@/lib/utils';
import { AgentRequestHint } from '@/ui/agent-request';
import { Button } from '@/ui/button';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import type { CastCastingResourceResponse, StudioAssetFileResponse } from '@/services/studio-project-contracts';
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
  const [preview, setPreview] = useState<{ costumeId: string; index: number } | null>(null);
  const previewCostume = preview ? resource.costumes.find((costume) => costume.id === preview.costumeId) ?? null : null;
  const previewSheet = preview ? resource.characterSheets[preview.index] ?? null : null;
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
                    {resource.characterSheets.map((sheet, index) => (
                      <CostumeSheetTile
                        key={sheet.id}
                        sheet={sheet}
                        costumeName={costume.name}
                        picked={sheet.id === costume.characterSheetAssetFileId}
                        disabled={pendingAssetFileId === sheet.id}
                        onPick={() => onPick(costume.id, sheet.id)}
                        onExpand={() => setPreview({ costumeId: costume.id, index })}
                      />
                    ))}
                  </div>
                ) : (
                  <span className='text-[11.5px] text-muted-foreground'>No sheet yet</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {preview && previewCostume && previewSheet ? (
        <ImagePreviewDialog
          images={resource.characterSheets.map((sheet) => ({
            src: sheet.url,
            alt: sheet.title ?? 'Character sheet',
            title: `${previewCostume.name} · ${sheet.title ?? 'Character sheet'}`,
          }))}
          currentIndex={preview.index}
          onCurrentIndexChange={(index) => setPreview({ costumeId: previewCostume.id, index })}
          onOpenChange={(open) => {
            if (!open) {
              setPreview(null);
            }
          }}
          actions={
            <PickSheetAction
              picked={previewSheet.id === previewCostume.characterSheetAssetFileId}
              disabled={pendingAssetFileId === previewSheet.id}
              onPick={() => onPick(previewCostume.id, previewSheet.id)}
            />
          }
        />
      ) : null}
    </section>
  );
}

/** One Character Sheet in a costume row: clicking it picks it, the corner button opens it large. */
function CostumeSheetTile({
  sheet,
  costumeName,
  picked,
  disabled,
  onPick,
  onExpand,
}: {
  sheet: StudioAssetFileResponse;
  costumeName: string;
  picked: boolean;
  disabled: boolean;
  onPick: () => void;
  onExpand: () => void;
}) {
  return (
    <div className='relative'>
      <Button
        type='button'
        variant='ghost'
        aria-pressed={picked}
        aria-label={`${picked ? 'Picked' : 'Pick'} for ${costumeName}: ${sheet.title ?? 'character sheet'}`}
        disabled={disabled}
        className={cn(
          'relative block aspect-[4/3] h-auto w-full overflow-hidden rounded-lg border border-border/40 bg-white/90 p-0 hover:bg-white/90 hover:ring-2 hover:ring-primary/50',
          picked ? 'outline-2 -outline-offset-2 outline-take-shot-selected-border' : null
        )}
        onClick={() => {
          if (!picked) {
            onPick();
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
      <ExpandSheetButton onClick={onExpand} className='absolute bottom-1.5 right-1.5' />
    </div>
  );
}
