import { Button } from '@/ui/button';

export function ActingTagChips(input: { tags: string[]; onInsert: (tag: string) => void }) {
  return (
    <>
      {input.tags.map((tag) => {
        const bracketed = bracketActingTag(tag);
        return (
          <Button
            key={tag}
            type='button'
            variant='ghost'
            className='h-auto rounded-full border border-[var(--dd-border)] bg-[var(--dd-card)] px-[9px] py-0.5 font-[family-name:var(--dd-font-mono)] text-xs font-normal text-[var(--dd-tag)] shadow-none hover:border-[var(--dd-tag)] hover:bg-[var(--dd-tag-bg)] hover:text-[var(--dd-tag)]'
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => input.onInsert(bracketed)}
          >
            {bracketed}
          </Button>
        );
      })}
    </>
  );
}

/** Suggestions are free-form; the chip shows and inserts them as one bracketed tag. */
function bracketActingTag(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed : `[${trimmed}]`;
}
