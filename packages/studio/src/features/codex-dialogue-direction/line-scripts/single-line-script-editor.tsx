import type { Ref } from 'react';
import type { Extension } from '@codemirror/state';
import type { DialogueDirectionLine } from '@gorenku/studio-codex/dialogue-direction';
import { DirectionEditor, type DirectionEditorHandle } from '../shared/direction-editor';
import { DirectionRevertButton } from '../shared/direction-revert-button';
import { SuggestedTagChips } from '../shared/suggested-tag-chips';

export function SingleLineScriptEditor(input: {
  line: DialogueDirectionLine;
  script: string;
  agentScript: string;
  highlight: Extension;
  suggestedTags: string[];
  editorRef: Ref<DirectionEditorHandle>;
  onScriptChange: (script: string) => void;
  onRevert: () => void;
  onInsertTag: (tag: string) => void;
  onGenerate: () => void;
}) {
  return (
    <>
      <p className='m-0 max-w-[40em] font-[family-name:var(--dd-font-script)] text-[15px] leading-[1.5] text-[var(--dd-card-fg)]'>{input.line.plainText}</p>
      <DirectionEditor
        value={input.script}
        onValueChange={input.onScriptChange}
        highlight={input.highlight}
        ariaLabel={`Direction for line ${input.line.number}`}
        handleRef={input.editorRef}
        onGenerate={input.onGenerate}
        footer={<>
          <SuggestedTagChips tags={input.suggestedTags} onInsert={input.onInsertTag} />
          <span className='flex-1' />
          {input.script !== input.agentScript ? <DirectionRevertButton onRevert={input.onRevert} /> : null}
        </>}
      />
    </>
  );
}
