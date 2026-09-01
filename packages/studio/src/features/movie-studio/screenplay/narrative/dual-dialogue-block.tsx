import type {
  DualDialogueBlock,
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { NarrativeDialogueBlock } from './dialogue-block';

export function NarrativeDualDialogueBlock({
  projectName,
  block,
  references,
  turnNumbers,
  onSelect,
}: {
  projectName: string;
  block: DualDialogueBlock;
  references: ScreenplayReference[];
  turnNumbers: ReadonlyMap<string, number>;
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <section aria-label='Dual Dialogue' className='grid grid-cols-2 items-start gap-4'>
      {[block.left, block.right].map((turn) => (
        <NarrativeDialogueBlock
          key={turn.id}
          projectName={projectName}
          turn={turn}
          references={references}
          turnNumber={turnNumbers.get(turn.id)!}
          onSelect={onSelect}
          compact
        />
      ))}
    </section>
  );
}
