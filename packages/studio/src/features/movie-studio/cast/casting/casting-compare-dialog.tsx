import { X } from 'lucide-react';
import { CompareView } from '@/features/casting-views/compare-view';
import type { CastCastingLookResponse } from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { lookKept } from './casting-summaries';

/** The shared Compare view for one Look's kept candidates, in a large window over the Casting tab. */
export function CastingCompareDialog({
  look,
  open,
  onOpenChange,
  pendingAssetFileId,
  onCast,
  onHide,
}: {
  look: CastCastingLookResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAssetFileId: string | null;
  onCast: (assetFileId: string) => void;
  onHide: (assetFileId: string) => void;
}) {
  const roundNumbers = new Map(look.rounds.map((round) => [round.id, round.number]));
  const candidates = lookKept(look).map((candidate) => ({
    assetFileId: candidate.assetFileId,
    imageUrl: candidate.assetFile.url,
    label: `Round ${roundNumbers.get(candidate.roundId)} · ${candidate.model.name}`,
  }));
  return (
    <Dialog open={open && candidates.length >= 2} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className='flex h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none'
      >
        <header className='flex h-11 flex-none items-center gap-2 px-[18px]'>
          <DialogTitle className='text-sm normal-case tracking-normal'>Compare · {look.name}</DialogTitle>
          <DialogDescription className='sr-only'>Two kept candidates side by side with one shared zoom; each side steps through the rest.</DialogDescription>
          <DialogClose asChild>
            <Button type='button' variant='ghost' size='icon' aria-label='Close compare' className='ml-auto h-7 w-7 text-muted-foreground hover:text-foreground'>
              <X className='h-3.5 w-3.5' />
            </Button>
          </DialogClose>
        </header>
        <CompareView
          candidates={candidates}
          castAssetFileId={look.castCandidateAssetFileId}
          disabled={pendingAssetFileId !== null}
          castDisabled={pendingAssetFileId !== null}
          onCast={onCast}
          onHide={onHide}
        />
      </DialogContent>
    </Dialog>
  );
}
