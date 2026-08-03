import type {
  OpeningElement,
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { NarrativeTextBlock } from './text-block';

export function NarrativeOpening({
  projectName,
  elements,
  references,
  onSelect,
}: {
  projectName: string;
  elements: OpeningElement[];
  references: ScreenplayReference[];
  onSelect: (selection: StudioSelection) => void;
}) {
  if (!elements.length) return null;
  return (
    <section
      aria-label='Screenplay opening'
      className='mb-10 space-y-6 border-b border-border/40 pb-10 text-[15.5px] leading-7'
    >
      {elements.map((element) => (
        <NarrativeTextBlock
          key={element.id}
          projectName={projectName}
          block={element}
          references={references.filter(
            (reference) =>
              reference.target.type === 'openingElement' &&
              reference.target.elementId === element.id
          )}
          onSelect={onSelect}
          opening
        />
      ))}
    </section>
  );
}
