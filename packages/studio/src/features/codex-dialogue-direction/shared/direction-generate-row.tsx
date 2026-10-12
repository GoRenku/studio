import type { DialogueDirectionOperation, DialogueDirectionRoute } from '@gorenku/studio-codex/dialogue-direction';
import type { JsonValue } from '@gorenku/studio-core/client';
import { CodexPanelGenerateButton } from '@/features/codex-panels/codex-panel-notice';
import { PanelNativeControls } from '@/features/codex-panels/panel-native-controls';
import { CharacterCount } from './character-count';
import { DirectionGenerateDisclosure } from './direction-generate-disclosure';
import { directionGenerateDisclosure } from './direction-disclosure';

/** The active operation's native settings, its advisory character count, Generate and its disclosure. */
export function DirectionGenerateRow(input: {
  route: DialogueDirectionRoute;
  operation: DialogueDirectionOperation;
  values: Record<string, JsonValue>;
  characterCount: number;
  generating: boolean;
  disabled: boolean;
  onValueChange: (key: string, value: JsonValue) => void;
  onGenerate: () => void;
}) {
  const controls = input.operation.controls.groups.flatMap((group) => group.fields);
  return (
    <>
      <div className='flex flex-wrap items-center gap-[22px]'>
        {controls.length > 0 ? <PanelNativeControls controls={controls} values={input.values} disabled={input.generating} onChange={input.onValueChange} /> : null}
        {input.operation.characterLimit !== null ? <CharacterCount count={input.characterCount} limit={input.operation.characterLimit} /> : null}
        <CodexPanelGenerateButton generating={input.generating} disabled={input.disabled} onGenerate={input.onGenerate} />
      </div>
      <DirectionGenerateDisclosure>{directionGenerateDisclosure(input.route)}</DirectionGenerateDisclosure>
    </>
  );
}
