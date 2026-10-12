import { Button } from '@/ui/button';

/** Skill-suggested direction text, shown and inserted exactly as supplied. */
export function SuggestedTagChips(input: { tags: string[]; onInsert: (tag: string) => void }) {
  return (
    <>
      {input.tags.map((tag) => (
        <Button
          key={tag}
          type='button'
          variant='ghost'
          className='h-auto rounded-full border border-[var(--dd-border)] bg-[var(--dd-card)] px-[9px] py-0.5 font-[family-name:var(--dd-font-mono)] text-xs font-normal text-[var(--dd-tag)] shadow-none hover:border-[var(--dd-tag)] hover:bg-[var(--dd-tag-bg)] hover:text-[var(--dd-tag)]'
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => input.onInsert(tag)}
        >
          {tag}
        </Button>
      ))}
    </>
  );
}
