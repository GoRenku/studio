import type {
  DialogueBlock,
  ScreenplayBlock,
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import type { SceneDialogueAudioWorkspaceWithUrls } from '@/services/screenplay';
import { NarrativeDialogueBlock } from './dialogue-block';
import { NarrativeDualDialogueBlock } from './dual-dialogue-block';
import { NarrativeTextBlock } from './text-block';

export function NarrativeBlock({
  projectName,
  block,
  references,
  audio,
  selectedTurnId,
  textPreviews,
  onOpenAudio,
  onSelect,
}: {
  projectName: string;
  block: ScreenplayBlock;
  references: ScreenplayReference[];
  audio: SceneDialogueAudioWorkspaceWithUrls;
  selectedTurnId: string | null;
  textPreviews: Record<string, string>;
  onOpenAudio: (turnId: string) => void;
  onSelect: (selection: StudioSelection) => void;
}) {
  switch (block.type) {
    case 'dialogue':
      return (
        <NarrativeDialogueBlock
          projectName={projectName}
          turn={asDialogueTurn(block)}
          references={references}
          audio={audio}
          selected={selectedTurnId === block.id}
          textPreview={textPreviews[block.id] ?? null}
          onOpenAudio={onOpenAudio}
          onSelect={onSelect}
        />
      );
    case 'dualDialogue':
      return (
        <NarrativeDualDialogueBlock
          projectName={projectName}
          block={block}
          references={references}
          audio={audio}
          selectedTurnId={selectedTurnId}
          textPreviews={textPreviews}
          onOpenAudio={onOpenAudio}
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
