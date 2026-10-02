import { useRef, useState } from 'react';
import type { GenerationReviewReference } from '@gorenku/studio-codex/client';
import type { CodexApp } from '@/services/codex-app';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { MediaGenerationConfiguration } from '@/features/media-generation-request/media-generation-configuration';
import { MediaGenerationReferenceCard } from '@/features/media-generation-request/media-generation-reference-card';
import { MediaGenerationRequestView, type MediaGenerationRequestTab } from '@/features/media-generation-request/media-generation-request-view';
import { GenerationReviewConfiguration } from './generation-review-controls';
import { useCodexGenerationReview } from './use-codex-generation-review';
import { useGenerationReferenceMedia } from './use-generation-reference-media';

export function CodexGenerationReviewPanel() {
  const interaction = useCodexGenerationReview();
  const [requestIndex, setRequestIndex] = useState(0);
  const [tab, setTab] = useState<MediaGenerationRequestTab>('prompt');
  const { review } = interaction;
  const activeIndex = review ? Math.min(requestIndex, review.requests.length - 1) : 0;
  const request = review?.requests[activeIndex];
  const draft = interaction.drafts[activeIndex];
  const locked = !interaction.connected || interaction.busy || Boolean(interaction.pendingResponse) || review?.phase !== 'ready';
  const selectedRoute = request?.routes.findIndex((route) => route.provider === request.preview.provider && route.model === request.preview.model && route.mediaKind === request.preview.mediaKind) ?? -1;
  const pendingRoute = review?.pendingRoute?.requestId === request?.requestId ? review?.pendingRoute?.route : undefined;

  return (
    <section aria-label='Generation review' className={`generation-request-dialog flex min-h-0 flex-col bg-background ${interaction.displayMode === 'fullscreen' ? 'h-screen' : 'h-[42rem]'}`}>
      <div className='grid gap-3 border-b p-5'>
        <h1 className='text-lg font-semibold'>Generation review</h1>
        {interaction.error ? <Alert variant='destructive'><AlertDescription>{interaction.error}</AlertDescription></Alert> : null}
        {!request || !draft ? <p role='status' className='text-sm text-muted-foreground'>Loading the prepared request…</p> : <>
          <Select value={String(selectedRoute)} disabled={locked} onValueChange={(index) => { void interaction.respond('reconfigure', { requestId: request.requestId, route: request.routes[Number(index)]! }); }}>
            <SelectTrigger aria-label='Provider and model' className='w-full'><SelectValue /></SelectTrigger>
            <SelectContent>{request.routes.map((route, index) => <SelectItem key={index} value={String(index)}>{route.providerLabel} · {route.label}</SelectItem>)}</SelectContent>
          </Select>
          {pendingRoute ? <p role='status' className='text-sm text-muted-foreground'>{review?.phase === 'preparationFailed' ? 'Preparation failed for' : 'Preparing'} {pendingRoute.providerLabel} · {pendingRoute.label}</p> : null}
          {review?.diagnostics.map((issue, index) => <Alert key={index} variant={issue.severity === 'error' ? 'destructive' : 'default'}><AlertDescription>{issue.message}</AlertDescription></Alert>)}
          {review?.phase === 'preparationFailed' && pendingRoute ? <Button variant='outline' onClick={() => { void interaction.respond('reconfigure', { requestId: request.requestId, route: request.routes[selectedRoute]! }); }}>Return to the prepared model</Button> : null}
          {review && review.requests.length > 1 ? <div className='flex items-center justify-between'>
            <Button variant='ghost' size='sm' aria-label='Previous generation request' disabled={activeIndex === 0} onClick={() => setRequestIndex(activeIndex - 1)}>Previous</Button>
            <span className='text-sm'>{activeIndex + 1} / {review.requests.length}</span>
            <Button variant='ghost' size='sm' aria-label='Next generation request' disabled={activeIndex + 1 >= review.requests.length} onClick={() => setRequestIndex(activeIndex + 1)}>Next</Button>
          </div> : null}
        </>}
      </div>
      {request && draft ? <div className='flex min-h-0 flex-1 flex-col'>
        <MediaGenerationRequestView
          preview={{ ...request.preview, editable: request.preview.editable && !locked }} prompt={draft.prompt} tab={tab}
          onPromptChange={(prompt) => interaction.editPrompt(request.requestId, prompt)} onTabChange={setTab}
          renderReference={(reference) => {
            const declared = request.preview.references.find((declared) => declared.requestPointer === reference.requestPointer)!;
            return interaction.bridge ? <CodexGenerationReference key={declared.referenceId} bridge={interaction.bridge} reference={declared} /> : null;
          }}
          configurationContent={<>
            <GenerationReviewConfiguration key={`${request.requestId}:${review?.revision}`} controls={request.controls} values={draft.values} disabled={locked} onChange={(key, value) => interaction.editValue(request.requestId, key, value)} />
            <MediaGenerationConfiguration
              provider={request.preview.provider} model={request.preview.model} value={request.preview.configuration} includeRoute={false}
              excludedPointers={[...request.controls.groups.flatMap((group) => group.fields.map((field) => field.key)), ...request.preview.references.map((reference) => reference.requestPointer)]}
            />
          </>}
        />
      </div> : null}
      <div className='flex flex-wrap justify-end gap-3 border-t p-5'>
        {interaction.pendingResponse && !interaction.busy ? <Button variant='outline' onClick={() => { void interaction.retryResponse(); }}>Retry review response</Button> : null}
        {interaction.notification ? <Button variant='outline' disabled={interaction.busy} onClick={() => { void interaction.retryNotification(); }}>Retry conversation notification</Button> : null}
        <Button variant='outline' disabled={!interaction.connected || interaction.busy || Boolean(interaction.pendingResponse) || !review || ['submitted', 'cancelled'].includes(review.phase)} onClick={() => { void interaction.respond('cancel'); }}>Cancel</Button>
        <Button disabled={locked || !request} onClick={() => { void interaction.respond('submit'); }}>Submit and generate</Button>
      </div>
      {review?.phase === 'submitted' ? <p role='status' className='px-5 pb-4 text-sm text-muted-foreground'>{interaction.notification ? 'The reviewed choices are saved. Conversation notification is pending.' : 'The reviewed request was submitted to the conversation.'}</p> : null}
      {review?.phase === 'cancelled' ? <p role='status' className='px-5 pb-4 text-sm text-muted-foreground'>Generation review canceled.</p> : null}
    </section>
  );
}

function CodexGenerationReference({ bridge, reference }: { bridge: CodexApp; reference: GenerationReviewReference }) {
  const container = useRef<HTMLDivElement>(null);
  const { source, error, loading } = useGenerationReferenceMedia(bridge, reference, container);
  return <div ref={container}><MediaGenerationReferenceCard reference={reference} source={source} />{loading && reference.kind === 'audio' ? <p role='status' className='mt-2 text-xs text-muted-foreground'>Loading audio…</p> : null}{error ? <p role='alert' className='mt-2 text-xs text-destructive'>{error}</p> : null}</div>;
}
