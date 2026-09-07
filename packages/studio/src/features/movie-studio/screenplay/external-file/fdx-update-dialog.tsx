import { useRef, useState } from 'react';
import { Button } from '@/ui/button';
import { Textarea } from '@/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import type { FdxUpdateReview } from '@gorenku/studio-core/client';
import type { useFdxUpdate } from './use-fdx-update';

type FdxUpdateController = ReturnType<typeof useFdxUpdate>;

export function FdxUpdateDialog({ controller }: { controller: FdxUpdateController }) {
  const later = useRef<HTMLButtonElement>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const { status, review, stale, busy, error } = controller;
  if (!status || status.state === 'notApplicable') return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(status.exportPath); setCopyError(null); }
    catch { setCopyError('Unable to copy. Select the path and copy it manually.'); }
  };
  return (
    <Dialog open={controller.open} onOpenChange={(open) => { if (!open && (!busy || !review)) controller.dismiss(); }}>
      <DialogContent className='flex max-h-[85vh] max-w-3xl flex-col overflow-hidden' onOpenAutoFocus={(event) => { event.preventDefault(); later.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>{review || status.state === 'pending' ? 'Update screenplay?' : 'External screenplay'}</DialogTitle>
          <DialogDescription>Export your updated screenplay as FDX to this file, replacing the previous export. Renku will ask before updating.</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <Textarea aria-label='External screenplay export path' className='resize-none font-mono text-xs' rows={3} readOnly value={status.exportPath} />
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' onClick={() => void copy()}>Copy path</Button>
            <Button variant='outline' onClick={controller.openFolder}>{controller.folderActionLabel}</Button>
            <Button variant='outline' onClick={controller.check}>Check for changes</Button>
          </div>
          {status.state === 'missing' && <p className='text-sm text-muted-foreground'>Waiting for an FDX export at this path.</p>}
          {status.state === 'settling' && <p className='text-sm text-muted-foreground'>The export is still settling. Renku will check again.</p>}
          {status.state === 'current' && <p className='text-sm text-muted-foreground'>This export is already accepted.</p>}
          {status.state === 'unavailable' && status.diagnostics.map((issue) => <p key={issue.code} className='text-sm text-destructive'>{issue.message}</p>)}
          {(error || copyError) && <p role='alert' className='text-sm text-destructive'>{error || copyError}</p>}
          {stale && <p role='alert' className='text-sm font-medium text-destructive'>The screenplay changed again. Review the latest export.</p>}
          {busy && <p role='status' className='text-sm text-muted-foreground'>{review ? 'Updating screenplay…' : 'Reviewing export…'}</p>}
          {review?.removedOrReplacedScenes.length ? <p className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm'>
            Existing work for {review.removedOrReplacedScenes.length} {review.removedOrReplacedScenes.length === 1 ? 'Scene' : 'Scenes'} will lose its current Scene connection. Even a small dialogue edit can replace an entire Scene. Beats, Shot Plans, Shots, and audio remain in history and are not attached to replacement Scenes.
          </p> : null}
          {review && <p className='text-sm'>{review.beforeSceneCount} → {review.afterSceneCount} Scenes · {review.retainedSceneCount} retained · {review.newScenes.length} new · {review.removedOrReplacedScenes.length} removed or replaced</p>}
        </div>
        {review && <ReviewImpact review={review} />}
        <DialogFooter>
          <Button ref={later} variant='outline' disabled={busy && !!review} onClick={controller.dismiss}>Later</Button>
          {(!review || stale) && status.state === 'pending'
            ? <Button key='review' type='button' disabled={busy} onClick={controller.reviewLatest}>Review latest export</Button>
            : <Button key={`apply:${review?.reviewFingerprint}`} type='button' disabled={!review || stale || busy || status.state !== 'pending'} onClick={controller.apply}>Update screenplay</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewImpact({ review }: { review: FdxUpdateReview }) {
  return <div className='min-h-0 space-y-4 overflow-y-auto pr-2 text-sm'>
    {review.change === 'sourceOnly' && <p>Only the source file changed. Screenplay content and production links stay the same.</p>}
    {review.survivingSceneOrderChanged && <p>The order of retained Scenes will change. Their production links stay attached.</p>}
    {review.openingChanged && <p>The screenplay opening will change.</p>}
    {review.analysisNeedsRefresh && <p>The active Screenplay Analysis will need refreshing.</p>}
    {review.removedOrReplacedScenes.length > 0 && <section className='space-y-2'>
      <h3 className='font-semibold'>Removed or replaced in Renku</h3>
      {review.removedOrReplacedScenes.map((scene) => <div key={scene.sceneId} className='rounded-md border p-3'>
        <p className='font-medium'>{scene.productionNumber ? `${scene.productionNumber} · ` : ''}{scene.heading}</p>
        {scene.title && <p>{scene.title}</p>}
        <p className='text-muted-foreground'>{scene.activeSceneBeats ? 'Active Beats · ' : ''}{scene.sceneBeatsRevisionCount} Beat revisions · {scene.shotPlanCount} Shot Plans · {scene.shotCount} Shots · {scene.dialogueAudioTakeCount} audio Takes</p>
      </div>)}
    </section>}
    {review.newScenes.length > 0 && <section className='space-y-2'>
      <h3 className='font-semibold'>New in Renku</h3>
      {review.newScenes.map((scene) => <p key={scene.sceneId}>{scene.productionNumber ? `${scene.productionNumber} · ` : ''}{scene.heading}</p>)}
    </section>}
  </div>;
}
