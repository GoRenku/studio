import type { Extension } from '@codemirror/state';
import type { DialogueDirectionLine } from '@gorenku/studio-codex/dialogue-direction';
import type { PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { DirectionEditor, type DirectionEditorHandle } from '../shared/direction-editor';
import { DirectionRevertButton } from '../shared/direction-revert-button';
import { SpeakerAvatar } from '../shared/speaker-avatar';
import { SuggestedTagChips } from '../shared/suggested-tag-chips';

export function MultiLineScriptEditor(input: {
  lines: DialogueDirectionLine[];
  media: PanelMediaLibrary;
  scripts: Record<number, string>;
  agentScripts: Record<number, string>;
  highlight: Extension;
  suggestedTags: string[];
  registerEditor: (line: number, handle: DirectionEditorHandle | null) => void;
  onEditorFocus: (line: number) => void;
  onScriptChange: (line: number, script: string) => void;
  onRevert: (line: number) => void;
  onInsertTag: (tag: string) => void;
  onGenerate: () => void;
}) {
  return (
    <>
      <div className='flex flex-col gap-3.5'>
        {input.lines.map((line) => {
          const script = input.scripts[line.number] ?? '';
          return (
            <div key={line.number} className='flex flex-col gap-1.5'>
              <div className='flex items-center gap-2'>
                <SpeakerAvatar speaker={line} media={input.media} />
                <b className='text-xs uppercase tracking-[0.04em]'>{line.speakerName}</b>
                <span className='ml-auto font-[family-name:var(--dd-font-mono)] text-[11px] font-medium text-[var(--dd-muted-fg)]'>{line.number}</span>
              </div>
              <p className='m-0 max-w-[40em] font-[family-name:var(--dd-font-script)] text-[13.5px] leading-[1.5] text-[var(--dd-card-fg)]'>{line.plainText}</p>
              <DirectionEditor
                size='compact'
                value={script}
                onValueChange={(next) => input.onScriptChange(line.number, next)}
                highlight={input.highlight}
                ariaLabel={`Direction for line ${line.number}`}
                handleRef={(handle) => input.registerEditor(line.number, handle)}
                onFocus={() => input.onEditorFocus(line.number)}
                onGenerate={input.onGenerate}
                footer={script !== (input.agentScripts[line.number] ?? '') ? <>
                  <span className='flex-1' />
                  <DirectionRevertButton onRevert={() => input.onRevert(line.number)} />
                </> : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className='flex flex-wrap gap-1.5'>
        <SuggestedTagChips tags={input.suggestedTags} onInsert={input.onInsertTag} />
      </div>
    </>
  );
}
