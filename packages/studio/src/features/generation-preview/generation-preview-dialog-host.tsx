import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type {
  GenerationPreviewConfigurationItem,
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { AudioPreview } from '@/ui/audio-preview';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { VideoPreview } from '@/ui/video-preview';
import { updateCastCharacterSheetPreviewReference } from '@/services/studio-generation-preview-api';

type PreviewTab = 'prompt' | 'references' | 'config' | 'issues';

interface GenerationPreviewEventDetail {
  projectName: string;
  preview: StudioGenerationPreview;
  eventId: string;
  createdAt: string;
}

export function GenerationPreviewDialogHost() {
  const [state, setState] = useState<{
    projectName: string;
    preview: StudioGenerationPreview;
    eventId: string;
    createdAt: string;
    revision: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PreviewTab>('prompt');
  const [updatingDependencyId, setUpdatingDependencyId] = useState<string | null>(
    null
  );
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<GenerationPreviewEventDetail>).detail;
      if (!detail?.preview) {
        return;
      }
      setState((previous) => ({
        projectName: detail.projectName,
        preview: detail.preview,
        eventId: detail.eventId,
        createdAt: detail.createdAt,
        revision:
          previous?.preview.previewId === detail.preview.previewId
            ? previous.revision + 1
            : 1,
      }));
      setUpdateError(null);
      setOpen(true);
    };
    window.addEventListener('renku:generation-preview-requested', handlePreview);
    return () =>
      window.removeEventListener(
        'renku:generation-preview-requested',
        handlePreview
      );
  }, []);

  const preview = state?.preview ?? null;

  const handleReferenceToggle = async (
    reference: StudioGenerationPreviewReference
  ) => {
    const control = reference.selectionControl;
    if (!state || !preview?.generationSpecId || !control?.editable) {
      return;
    }
    const inclusion = reference.selected ? 'exclude' : 'include';
    setUpdatingDependencyId(control.dependencyId);
    setUpdateError(null);
    try {
      const nextPreview = await updateCastCharacterSheetPreviewReference({
        projectName: state.projectName,
        specId: preview.generationSpecId,
        dependencyId: control.dependencyId,
        inclusion,
      });
      setState((current) =>
        current
          ? {
              ...current,
              preview: nextPreview,
              createdAt: new Date().toISOString(),
              revision: current.revision + 1,
            }
          : current
      );
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
    } finally {
      setUpdatingDependencyId(null);
    }
  };

  return (
    <Dialog open={open && Boolean(preview)} onOpenChange={setOpen}>
      <DialogContent className='max-h-[88vh] max-w-[1180px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0'>
        {preview ? (
          <>
            <DialogHeader>
              <div className='flex flex-wrap items-start justify-between gap-4 pr-8'>
                <div className='min-w-0 flex flex-col gap-2'>
                  <DialogTitle>{preview.title}</DialogTitle>
                  <DialogDescription>
                    {preview.subject.projectLabel}
                  </DialogDescription>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='accent'>{purposeLabel(preview.purpose)}</Badge>
                  <Badge>{preview.model.provider}</Badge>
                  <Badge>{preview.model.modelId}</Badge>
                  <Badge variant='outline'>Revision {state?.revision ?? 1}</Badge>
                </div>
              </div>
              <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                {headerSubjectLabels(preview, state?.createdAt).map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              {updateError ? (
                <Alert variant='destructive'>
                  <AlertCircle />
                  <AlertTitle>Preview Update Failed</AlertTitle>
                  <AlertDescription>{updateError}</AlertDescription>
                </Alert>
              ) : null}
            </DialogHeader>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as PreviewTab)}
              className='min-h-0 overflow-hidden px-6'
            >
              <TabsList variant='line' className='w-full justify-start'>
                <TabsTrigger value='prompt'>Prompt</TabsTrigger>
                <TabsTrigger value='references'>References</TabsTrigger>
                <TabsTrigger value='config'>Config</TabsTrigger>
                <TabsTrigger value='issues'>Issues</TabsTrigger>
              </TabsList>
              <TabsContent value='prompt' className='min-h-0 overflow-auto py-4'>
                <PromptTab preview={preview} />
              </TabsContent>
              <TabsContent value='references' className='min-h-0 overflow-auto py-4'>
                <ReferencesTab
                  preview={preview}
                  updatingDependencyId={updatingDependencyId}
                  onReferenceToggle={handleReferenceToggle}
                />
              </TabsContent>
              <TabsContent value='config' className='min-h-0 overflow-auto py-4'>
                <ConfigTab preview={preview} />
              </TabsContent>
              <TabsContent value='issues' className='min-h-0 overflow-auto py-4'>
                <IssuesTab preview={preview} />
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant='outline' onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PromptTab({ preview }: { preview: StudioGenerationPreview }) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='rounded-md border border-border/50 bg-muted/20 p-4'>
        <pre className='whitespace-pre-wrap font-mono text-xs leading-5 text-foreground'>
          {preview.finalPrompt.text}
        </pre>
      </div>
      {preview.finalPrompt.negativePrompt ? (
        <Section title='Negative Prompt'>
          <p className='whitespace-pre-wrap text-sm text-muted-foreground'>
            {preview.finalPrompt.negativePrompt}
          </p>
        </Section>
      ) : null}
      {preview.promptSheetVisualStyleId || preview.promptSheetNotationModeId ? (
        <Section title='Prompt Sheet Metadata'>
          <div className='grid grid-cols-2 gap-2'>
            <InfoCell
              label='Visual Style'
              value={preview.promptSheetVisualStyleId}
            />
            <InfoCell
              label='Notation Mode'
              value={preview.promptSheetNotationModeId}
            />
          </div>
        </Section>
      ) : null}
      <Section title='Provider Tokens'>
        <TokenRows references={preview.references} />
      </Section>
    </div>
  );
}

function ReferencesTab({
  preview,
  updatingDependencyId,
  onReferenceToggle,
}: {
  preview: StudioGenerationPreview;
  updatingDependencyId: string | null;
  onReferenceToggle(reference: StudioGenerationPreviewReference): void;
}) {
  return (
    <div className='grid grid-cols-3 gap-3'>
      {preview.references.map((reference, index) => (
        <ReferenceCard
          key={`${reference.kind}:${reference.assetId}:${reference.assetFileId}:${index}`}
          reference={reference}
          index={index}
          canEdit={Boolean(preview.generationSpecId)}
          updating={
            updatingDependencyId === reference.selectionControl?.dependencyId
          }
          onToggle={onReferenceToggle}
        />
      ))}
    </div>
  );
}

function ConfigTab({ preview }: { preview: StudioGenerationPreview }) {
  const providerItems = useMemo(
    () =>
      [
        { key: 'provider', label: 'Provider', value: preview.model.provider },
        { key: 'modelId', label: 'Model', value: preview.model.modelId },
        { key: 'route', label: 'Route', value: preview.model.route ?? null },
        {
          key: 'executionPath',
          label: 'Execution path',
          value: preview.model.executionPath ?? null,
        },
        ...preview.configuration,
      ] satisfies GenerationPreviewConfigurationItem[],
    [preview]
  );
  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-3 gap-2'>
        {providerItems.map((item) => (
          <InfoCell
            key={item.key}
            label={item.label}
            value={formatConfigValue(item.value)}
          />
        ))}
      </div>
      {preview.providerPreview?.payload ? (
        <Section title='Provider Payload'>
          <pre className='max-h-[360px] overflow-auto rounded-md border border-border/50 bg-muted/20 p-3 font-mono text-xs leading-5'>
            {JSON.stringify(preview.providerPreview.payload, null, 2)}
          </pre>
        </Section>
      ) : null}
    </div>
  );
}

function IssuesTab({ preview }: { preview: StudioGenerationPreview }) {
  if (!preview.diagnostics.length) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>No Issues</AlertTitle>
        <AlertDescription>
          The preview did not report structured diagnostics.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className='flex flex-col gap-3'>
      {preview.diagnostics.map((issue, index) => (
        <Alert
          key={`${issue.code}:${index}`}
          variant={issue.severity === 'error' ? 'destructive' : 'default'}
        >
          <AlertCircle />
          <AlertTitle>{issue.code}</AlertTitle>
          <AlertDescription>
            <p>{issue.message}</p>
            {issue.suggestion ? <p>{issue.suggestion}</p> : null}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

function ReferenceCard({
  reference,
  index,
  canEdit,
  updating,
  onToggle,
}: {
  reference: StudioGenerationPreviewReference;
  index: number;
  canEdit: boolean;
  updating: boolean;
  onToggle(reference: StudioGenerationPreviewReference): void;
}) {
  const canToggle =
    canEdit &&
    Boolean(reference.selectionControl?.editable) &&
    !reference.selectionControl?.required;
  return (
    <article className='min-h-48 rounded-md border border-border/50 bg-card/60 p-3'>
      <div className='mb-3 flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            {reference.kind} {index + 1}
          </p>
          <h3 className='truncate text-sm font-semibold text-foreground'>
            {reference.label}
          </h3>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Badge variant={reference.selected ? 'accent' : 'outline'}>
            {reference.selected ? 'Included' : 'Excluded'}
          </Badge>
          {canToggle ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={updating}
              onClick={() => onToggle(reference)}
            >
              {updating
                ? 'Updating'
                : reference.selected
                  ? 'Exclude'
                  : 'Include'}
            </Button>
          ) : null}
        </div>
      </div>
      {reference.kind === 'image' && reference.browserUrl ? (
        <img
          src={reference.browserUrl}
          alt={reference.label}
          className='mb-3 aspect-video w-full rounded-md object-cover'
        />
      ) : null}
      {reference.kind === 'video' && reference.browserUrl ? (
        <VideoPreview
          src={reference.browserUrl}
          title={reference.label}
          active
          className='mb-3 aspect-video w-full rounded-md object-cover'
        />
      ) : null}
      {reference.kind === 'audio' ? (
        <AudioPreview
          src={reference.browserUrl}
          title={reference.label}
          className='mb-3 w-full'
        />
      ) : null}
      <div className='grid grid-cols-1 gap-2 text-xs'>
        <InfoCell label='Role' value={reference.role} />
        <InfoCell label='Token' value={reference.providerToken} />
      </div>
    </article>
  );
}

function TokenRows({ references }: { references: StudioGenerationPreviewReference[] }) {
  const tokenReferences = references.filter((reference) => reference.providerToken);
  if (!tokenReferences.length) {
    return <p className='text-sm text-muted-foreground'>No provider tokens.</p>;
  }
  return (
    <div className='grid grid-cols-[120px_1fr_1fr] gap-2 text-xs'>
      {tokenReferences.map((reference) => (
        <Fragment key={`${reference.providerToken}:${reference.assetId}:${reference.assetFileId}`}>
          <span className='font-mono text-muted-foreground'>{reference.providerToken}</span>
          <span className='text-foreground'>{reference.label}</span>
          <span className='text-muted-foreground'>{reference.role}</span>
        </Fragment>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='flex flex-col gap-2'>
      <h2 className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoCell({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className='rounded-md border border-border/40 bg-background/40 px-3 py-2'>
      <p className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {label}
      </p>
      <p className='mt-1 break-words text-xs text-foreground'>
        {value === undefined || value === null || value === '' ? 'Not set' : String(value)}
      </p>
    </div>
  );
}

function formatConfigValue(value: GenerationPreviewConfigurationItem['value']) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value;
}

function headerSubjectLabels(
  preview: StudioGenerationPreview,
  createdAt: string | undefined
): string[] {
  return [
    preview.subject.castMemberLabel,
    preview.subject.sceneLabel,
    preview.subject.takeLabel,
    preview.subject.shotLabel,
    createdAt ? `Updated ${formatTime(createdAt)}` : undefined,
  ].filter((label): label is string => Boolean(label));
}

function purposeLabel(purpose: StudioGenerationPreview['purpose']): string {
  switch (purpose) {
    case 'shot.video-prompt-sheet':
      return 'Video Prompt Sheet';
    case 'shot.video-take':
      return 'Video Take';
    case 'cast.character-sheet':
      return 'Character Sheet';
  }
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
