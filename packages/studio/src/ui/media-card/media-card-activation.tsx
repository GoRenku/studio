import { useRef, useState } from 'react';
import { Button } from '@/ui/button';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import type { MediaCardActivation } from './media-card-contract';

export function MediaCardActivationLayer({
  activation,
}: {
  activation: MediaCardActivation;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const activate = () => {
    if (activation.kind === 'callback') {
      activation.onActivate();
      return;
    }
    setPreviewOpen(true);
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type='button'
        variant='ghost'
        aria-label={activation.label}
        disabled={activation.disabled}
        className='absolute inset-0 z-20 h-full w-full overflow-hidden rounded-[inherit] p-0 text-left hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        onClick={activate}
      />
      {activation.kind === 'image-preview' ? (
        <ImagePreviewDialog
          images={previewOpen ? [activation.image] : []}
          currentIndex={0}
          onOpenChange={(open) => {
            setPreviewOpen(open);
            if (!open) {
              window.setTimeout(() => triggerRef.current?.focus(), 0);
            }
          }}
        />
      ) : null}
    </>
  );
}
