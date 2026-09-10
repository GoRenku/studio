import { Button } from '@/ui/button';
import { usePrevis } from './use-previs';
import { usePrevisPlayback } from './use-previs-playback';
import { PrevisMonitor } from './monitor';
import { PrevisCues, PrevisLegend } from './cues';
import { PrevisDescription } from './description';

export function PrevisTab({ projectName, sceneId, shotPlanId }: { projectName: string; sceneId: string; shotPlanId: string }) {
  const previs = usePrevis(projectName, sceneId, shotPlanId);
  const renderFile = previs.revision?.render?.files.find((file) => file.role === 'primary' && file.mediaKind === 'video');
  return <PrevisWorkspace key={`${previs.revision?.id ?? 'empty'}:${renderFile?.url ?? 'unavailable'}`} previs={previs} />;
}

function PrevisWorkspace({ previs }: { previs: ReturnType<typeof usePrevis> }) {
  const generationUrl = previs.generation?.files.find((file) => file.role === 'primary' && file.mediaKind === 'video')?.url;
  const playback = usePrevisPlayback(generationUrl, previs.revision?.playback);
  return <div className='flex h-full flex-col overflow-y-auto p-5'>
    {previs.error ? <div role='alert' className='mb-3 flex items-center gap-3 text-xs text-destructive'>{previs.error}<Button variant='outline' size='sm' onClick={previs.reload}>Retry</Button></div> : null}
    <PrevisMonitor revision={previs.revision} revisions={previs.resource?.revisions ?? []} generation={previs.generation}
      onRevision={(id) => { playback.pause(); previs.setRevisionId(id); }} onGeneration={(id) => { playback.cancel(); previs.setGenerationId(id); }} playback={playback}
      status={previs.error ? 'Previs unavailable' : !previs.resource ? 'Loading Previs…' : undefined} />
    <PrevisLegend revision={previs.revision} />
    <div className='grid min-h-[340px] flex-1 grid-cols-[minmax(0,61fr)_minmax(0,39fr)] gap-4'>
      <PrevisCues revision={previs.revision} time={playback.time} duration={playback.duration} activeCue={playback.activeCue} playing={playback.playing} seek={playback.seek} playDialogue={playback.playDialogue} selection={playback.selection} />
      <PrevisDescription value={previs.revision?.description ?? null} unavailable={previs.revision?.warnings.some((warning) => warning.location.path[0] === 'description')} />
    </div>
  </div>;
}
