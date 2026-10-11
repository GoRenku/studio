import { Textarea } from '@/ui/textarea';
import { ImageEditSectionHeading } from './image-edit-panel-frame';

export function WholeImageDirection(input: { value: string; disabled: boolean; onChange: (value: string) => void; onSubmit: () => void }) {
  return (
    <section className='flex flex-col gap-2.5'>
      <ImageEditSectionHeading>Whole image</ImageEditSectionHeading>
      <Textarea
        aria-label='Whole image instruction'
        rows={2}
        disabled={input.disabled}
        placeholder='Optional: a change across the whole image'
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
        onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); input.onSubmit(); } }}
        className='min-h-14 resize-none rounded-lg border-[var(--dd-border)] bg-[var(--dd-editor)] text-[12.5px] leading-normal text-[var(--dd-card-fg)] shadow-none [field-sizing:content] placeholder:text-[var(--dd-muted-fg)] focus-visible:ring-[var(--dd-primary)]'
      />
      <p className='m-0 text-[11.5px] leading-normal text-[var(--dd-muted-fg)]'>Name project items in plain words, such as “the Ottoman helmet from Props”. The agent adds them as reference images.</p>
    </section>
  );
}
