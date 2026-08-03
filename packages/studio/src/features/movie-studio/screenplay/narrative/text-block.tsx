import type {
  ScreenplayReference,
  StudioSelection,
  TextBlock,
} from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { ReferenceText } from './reference-text';

export function NarrativeTextBlock({
  projectName,
  block,
  references,
  onSelect,
  opening = false,
}: {
  projectName: string;
  block: TextBlock;
  references: ScreenplayReference[];
  onSelect: (selection: StudioSelection) => void;
  opening?: boolean;
}) {
  const content = (
    <ReferenceText
      projectName={projectName}
      text={block.text}
      references={references}
      onSelect={onSelect}
    />
  );

  switch (block.type) {
    case 'transition':
      return <p className='pt-2 text-right text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>{content}</p>;
    case 'shot':
    case 'specialHeading':
      return <p className='pt-1 font-mono text-[12.5px] font-semibold uppercase tracking-[0.16em] text-foreground'>{content}</p>;
    case 'titleCard':
    case 'super':
      return <p className='text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-foreground'>{content}</p>;
    case 'note':
      return <p className='border-l-2 border-primary/40 pl-3 text-[13.5px] italic text-muted-foreground'>{content}</p>;
    case 'lyrics':
      return <p className='whitespace-pre-wrap pl-8 italic text-foreground/85'>{content}</p>;
    case 'castList':
      return <p className='whitespace-pre-wrap rounded-md border border-border/40 bg-muted/20 px-4 py-3 font-mono text-[13px] leading-6'>{content}</p>;
    case 'action':
    default:
      return (
        <p className={cn('whitespace-pre-wrap', opening && 'text-foreground/85')}>
          {content}
        </p>
      );
  }
}
