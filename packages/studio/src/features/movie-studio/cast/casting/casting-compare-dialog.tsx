import { X } from 'lucide-react';
import type { CastingRoundKind } from '@gorenku/studio-core/client';
import { CompareView } from '@/features/casting-views/compare-view';
import type { CastingRoundViewResponse } from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { keptCandidates } from './casting-summaries';

/** The shared Compare view for the kept images of a Look's or costume's rounds, in a large window over the Casting tab. */
export function CastingCompareDialog({
  kind,
  title,
  rounds,
  chosenAssetFileId,
  open,
  onOpenChange,
  pendingAssetFileId,
  onChoose,
  onHide,
}: {
  kind: CastingRoundKind;
  title: string;
  rounds: CastingRoundViewResponse[];
  chosenAssetFileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAssetFileId: string | null;
  onChoose: (assetFileId: string) => void;
  onHide: (assetFileId: string) => void;
}) {
  const roundNumbers = new Map(rounds.map((round) => [round.id, round.number]));
  const candidates = keptCandidates(rounds, chosenAssetFileId).map((candidate) => ({
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
          <DialogTitle className='text-sm normal-case tracking-normal'>Compare · {title}</DialogTitle>
          <DialogDescription className='sr-only'>Two kept images side by side with one shared zoom; each side steps through the rest.</DialogDescription>
          <DialogClose asChild>
            <Button type='button' variant='ghost' size='icon' aria-label='Close compare' className='ml-auto h-7 w-7 text-muted-foreground hover:text-foreground'>
              <X className='h-3.5 w-3.5' />
            </Button>
          </DialogClose>
        </header>
        <CompareView
          kind={kind}
          candidates={candidates}
          chosenAssetFileId={chosenAssetFileId}
          disabled={pendingAssetFileId !== null}
          chooseDisabled={pendingAssetFileId !== null}
          onChoose={onChoose}
          onHide={onHide}
        />
      </DialogContent>
    </Dialog>
  );
}
