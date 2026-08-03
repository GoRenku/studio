import type {
  DualDialogueBlock,
  ScreenplayReference,
  StudioSelection,
} from '@gorenku/studio-core/client';
import type { SceneDialogueAudioWorkspaceWithUrls } from '@/services/screenplay';
import { NarrativeDialogueBlock } from './dialogue-block';

export function NarrativeDualDialogueBlock({
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
  block: DualDialogueBlock;
  references: ScreenplayReference[];
  audio: SceneDialogueAudioWorkspaceWithUrls;
  selectedTurnId: string | null;
  textPreviews: Record<string, string>;
  onOpenAudio: (turnId: string) => void;
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
          audio={audio}
          selected={selectedTurnId === turn.id}
          textPreview={textPreviews[turn.id] ?? null}
          onOpenAudio={onOpenAudio}
          onSelect={onSelect}
          compact
        />
      ))}
    </section>
  );
}
