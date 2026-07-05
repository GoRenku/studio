import type { StudioGenerationPreview } from '@gorenku/studio-core/client';

interface GenerationPreviewPromptPanelProps {
  preview: StudioGenerationPreview;
}

export function GenerationPreviewPromptPanel({
  preview,
}: GenerationPreviewPromptPanelProps) {
  return (
    <div className='flex min-h-0 flex-col gap-4'>
      <section className='flex flex-col gap-2 rounded-md border border-border/50 bg-card/40 p-4'>
        <p className='whitespace-pre-wrap text-sm leading-6 text-foreground'>
          {preview.finalPrompt.text}
        </p>
      </section>
      {preview.finalPrompt.negativePrompt ? (
        <section className='flex flex-col gap-2'>
          <h2 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            Negative Prompt
          </h2>
          <div className='rounded-md border border-border/50 bg-card/40 p-4'>
            <p className='whitespace-pre-wrap text-sm leading-6 text-foreground'>
              {preview.finalPrompt.negativePrompt}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
