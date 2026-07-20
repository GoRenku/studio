import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PromptEditor } from './prompt-editor';
import type { GenerationPromptReferenceMention } from './prompt-mentions';

interface GenerationRequestPromptPanelProps {
  authoredText: string;
  negativeText?: string;
  preview: GenerationPreviewResource | null;
  editorRevision: number;
  readOnly: boolean;
  onAuthoredTextChange: (value: string) => void;
  onNegativeTextChange: (value: string) => void;
  authoredPlaceholder?: string;
}

export function GenerationRequestPromptPanel({
  authoredText,
  negativeText,
  preview,
  editorRevision,
  readOnly,
  onAuthoredTextChange,
  onNegativeTextChange,
  authoredPlaceholder,
}: GenerationRequestPromptPanelProps) {
  const mentions = useMemo(() => selectedImageMentions(preview), [preview]);
  return (
    <div className={cn(
      'mx-auto grid h-full min-h-0 w-full max-w-[790px] gap-4',
      negativeText === undefined
        ? 'grid-rows-[minmax(0,1fr)]'
        : 'grid-rows-[minmax(0,3fr)_minmax(0,1fr)]',
    )}>
      <PromptEditor
        key={`authored-prompt:${editorRevision}`}
        value={authoredText}
        onValueChange={onAuthoredTextChange}
        mentions={mentions}
        readOnly={readOnly}
        ariaLabel='Generation prompt'
        placeholder={authoredPlaceholder}
      />
      {negativeText !== undefined ? (
        <section className='flex min-h-0 flex-col gap-2'>
          <h2 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            Negative Prompt
          </h2>
          <PromptEditor
            key={`negative-prompt:${editorRevision}`}
            value={negativeText}
            onValueChange={onNegativeTextChange}
            mentions={mentions}
            readOnly={readOnly}
            ariaLabel='Negative generation prompt'
            className='min-h-0 flex-1'
          />
        </section>
      ) : null}
    </div>
  );
}

function selectedImageMentions(
  preview: GenerationPreviewResource | null,
): GenerationPromptReferenceMention[] {
  if (!preview) return [];
  const references = [
    ...preview.references.slots.flatMap((slot) => slot.current ? [slot.current] : []),
    ...preview.references.additional,
  ];
  const mentions = new Map<string, GenerationPromptReferenceMention>();
  for (const reference of references) {
    if (reference.kind === 'image' && reference.promptMention) {
      mentions.set(reference.promptMention, {
        value: reference.promptMention,
        label: reference.label,
        previewImageUrl: reference.browserUrl,
      });
    }
  }
  return [...mentions.values()];
}
