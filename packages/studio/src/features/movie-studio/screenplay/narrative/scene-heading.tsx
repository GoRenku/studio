import type { ScreenplayReference, StudioSelection } from '@gorenku/studio-core/client';
import { ReferenceText } from './reference-text';

export function NarrativeSceneHeading({
  projectName,
  heading,
  references,
  onSelect,
}: {
  projectName: string;
  heading: string;
  references: ScreenplayReference[];
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <header className='font-mono text-[12.5px] uppercase tracking-[0.16em] text-muted-foreground'>
      <ReferenceText
        projectName={projectName}
        text={heading}
        references={references}
        onSelect={onSelect}
      />
    </header>
  );
}
