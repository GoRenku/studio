import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ImageEditStyleReference } from '@gorenku/studio-codex/image-edit';
import { usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog';
import { ImageEditSectionHeading } from './image-edit-panel-frame';

const LOOKBOOK_LABELS: Record<ImageEditStyleReference['lookbook'], string> = {
  production: 'Production lookbook',
  storyboard: 'Storyboard lookbook',
};

/** At most one style reference, chosen from the Project's Production and Storyboard Lookbook sheets. */
export function StyleReferencePicker(input: {
  references: ImageEditStyleReference[];
  selectedAssetFileId: string | null;
  disabled: boolean;
  media: PanelMediaLibrary;
  onChange: (assetFileId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = input.references.find((reference) => reference.assetFileId === input.selectedAssetFileId);
  const groups = (['production', 'storyboard'] as const)
    .map((lookbook) => ({ lookbook, references: input.references.filter((reference) => reference.lookbook === lookbook) }))
    .filter((group) => group.references.length > 0);
  if (input.references.length === 0) return null;
  return (
    <section className='flex flex-col gap-2.5'>
      <ImageEditSectionHeading>Style reference</ImageEditSectionHeading>
      {selected ? (
        <div className='flex items-center gap-2 rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)] p-1'>
          <StyleThumbnail reference={selected} media={input.media} className='h-[30px] w-11' />
          <span className='min-w-0'>
            {selected.name ? <b className='block truncate text-xs font-semibold'>{selected.name}</b> : null}
            <span className='block truncate text-[10.5px] text-[var(--dd-muted-fg)]'>{LOOKBOOK_LABELS[selected.lookbook]}</span>
          </span>
          <Button type='button' variant='ghost' size='icon' aria-label='Remove style reference' disabled={input.disabled} onClick={() => input.onChange(null)} className='ml-auto size-6 rounded-full text-[var(--dd-muted-fg)] hover:bg-[var(--dd-hover)]'>
            <X className='size-3.5' />
          </Button>
        </div>
      ) : (
        <Button type='button' variant='ghost' disabled={input.disabled} onClick={() => setOpen(true)} className='h-auto self-start rounded-full border border-dashed border-[var(--dd-border)] px-2.5 py-1 text-[11.5px] font-normal text-[var(--dd-muted-fg)] shadow-none hover:border-[var(--dd-primary)] hover:bg-transparent hover:text-[var(--dd-fg)]'>
          <Plus className='size-3' />From visual language
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='image-edit max-h-[80vh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Style reference</DialogTitle>
            <DialogDescription>Choose one sheet from the Project's visual language.</DialogDescription>
          </DialogHeader>
          {groups.map((group) => (
            <div key={group.lookbook} className='flex flex-col gap-2'>
              <ImageEditSectionHeading>{LOOKBOOK_LABELS[group.lookbook]}</ImageEditSectionHeading>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {group.references.map((reference) => (
                  <Button
                    key={reference.assetFileId}
                    type='button'
                    variant='ghost'
                    aria-label={reference.name ?? `${LOOKBOOK_LABELS[reference.lookbook]} sheet`}
                    onClick={() => { input.onChange(reference.assetFileId); setOpen(false); }}
                    className='h-auto flex-col items-stretch gap-1 rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)] p-1 text-left shadow-none hover:border-[var(--dd-primary)] hover:bg-[var(--dd-card)]'
                  >
                    <StyleThumbnail reference={reference} media={input.media} className='aspect-[16/10] w-full' />
                    {reference.name ? <b className='truncate px-0.5 text-[11px] font-semibold'>{reference.name}</b> : null}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StyleThumbnail(input: { reference: ImageEditStyleReference; media: PanelMediaLibrary; className: string }) {
  const { url } = usePanelMediaUrl(input.media, input.reference.imageUri);
  return (
    <span className={`${input.className} block flex-none overflow-hidden rounded-[5px] bg-[var(--dd-muted)]`}>
      {url ? <img alt='' src={url} className='size-full object-cover' /> : null}
    </span>
  );
}
