import type {
  DialogueBlock,
  ScreenplayBlock,
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { NarrativeDialogueBlock } from './dialogue-block';
import { NarrativeDualDialogueBlock } from './dual-dialogue-block';
import { NarrativeTextBlock } from './text-block';

export function NarrativeBlock({
  projectName,
  block,
  references,
  turnNumbers,
  onSelect,
}: {
  projectName: string;
  block: ScreenplayBlock;
  references: ScreenplayReference[];
  turnNumbers: ReadonlyMap<string, number>;
  onSelect: (selection: StudioSelection) => void;
}) {
  switch (block.type) {
    case 'dialogue':
      return (
        <NarrativeDialogueBlock
          projectName={projectName}
          turn={asDialogueTurn(block)}
          references={references}
          turnNumber={turnNumbers.get(block.id)!}
          onSelect={onSelect}
        />
      );
    case 'dualDialogue':
      return (
        <NarrativeDualDialogueBlock
          projectName={projectName}
          block={block}
          references={references}
          turnNumbers={turnNumbers}
          onSelect={onSelect}
        />
      );
    case 'action':
    case 'transition':
    case 'shot':
    case 'lyrics':
    case 'castList':
    case 'note':
    case 'specialHeading':
    case 'titleCard':
    case 'super':
      return (
        <NarrativeTextBlock
          projectName={projectName}
          block={block}
          references={references.filter(
            (reference) =>
              reference.target.type === 'block' &&
              reference.target.blockId === block.id
          )}
          onSelect={onSelect}
        />
      );
    default:
      return assertNever(block);
  }
}

function asDialogueTurn(block: DialogueBlock) {
  return {
    id: block.id,
    characterName: block.characterName,
    extensions: block.extensions,
    parts: block.parts,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported screenplay block: ${String(value)}`);
}
