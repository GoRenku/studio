import { SyntaxTextEditor } from '@/ui/syntax-text-editor';
import { cn } from '@/lib/utils';

interface GenerationPreviewPromptPanelProps {
  authoredText: string;
  negativeText?: string;
  editorRevision: number;
  readOnly: boolean;
  onAuthoredTextChange: (value: string) => void;
  onNegativeTextChange: (value: string) => void;
}

export function GenerationPreviewPromptPanel({
  authoredText,
  negativeText,
  editorRevision,
  readOnly,
  onAuthoredTextChange,
  onNegativeTextChange,
}: GenerationPreviewPromptPanelProps) {
  return (
    <div
      className={cn(
        'grid h-full min-h-0 gap-4',
        negativeText === undefined
          ? 'grid-rows-[minmax(0,1fr)]'
          : 'grid-rows-[minmax(0,3fr)_minmax(0,1fr)]'
      )}
    >
      <SyntaxTextEditor
        key={`authored-prompt:${editorRevision}`}
        value={authoredText}
        onValueChange={onAuthoredTextChange}
        language='markdown'
        readOnly={readOnly}
        wordWrap
        ariaLabel='Generation prompt'
        className='min-h-0'
      />
      {negativeText !== undefined ? (
        <section className='flex min-h-0 flex-col gap-2'>
          <h2 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            Negative Prompt
          </h2>
          <SyntaxTextEditor
            key={`negative-prompt:${editorRevision}`}
            value={negativeText}
            onValueChange={onNegativeTextChange}
            language='markdown'
            readOnly={readOnly}
            wordWrap
            ariaLabel='Negative generation prompt'
            className='min-h-0 flex-1'
          />
        </section>
      ) : null}
    </div>
  );
}
