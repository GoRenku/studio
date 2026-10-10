import type { Ref } from 'react';
import type { DialogueDirectionLine, DialogueDirectionVoice } from '@gorenku/studio-codex/dialogue-direction';
import { DirectionEditor, type DirectionEditorHandle } from '../shared/direction-editor';
import { DirectionRevertButton } from '../shared/direction-revert-button';
import { SpeakerAvatar } from '../shared/speaker-avatar';
import { SpeakerVoiceSelect } from '../shared/speaker-voice-select';
import type { DirectionMediaLibrary } from '../shared/use-direction-media';
import { ActingTagChips } from './acting-tag-chips';
import { actingScriptHighlight } from './acting-script-highlight';

export function SingleLineDesk(input: {
  line: DialogueDirectionLine;
  voices: DialogueDirectionVoice[];
  castVoiceId?: string;
  media: DirectionMediaLibrary;
  actingScript: string;
  agentActingScript: string;
  suggestedTags: string[];
  editorRef: Ref<DirectionEditorHandle>;
  onCastVoiceChange: (castVoiceId: string) => void;
  onActingScriptChange: (actingScript: string) => void;
  onRevert: () => void;
  onInsertTag: (tag: string) => void;
  onGenerate: () => void;
}) {
  const { line } = input;
  return (
    <>
      <div className='flex items-center gap-2.5'>
        <SpeakerAvatar speaker={line} media={input.media} />
        <b className='text-[13px] uppercase tracking-[0.04em]'>{line.speakerName}</b>
        {input.castVoiceId ? (
          <span className='ml-auto'>
            <SpeakerVoiceSelect speakerName={line.speakerName} voices={input.voices} castVoiceId={input.castVoiceId} media={input.media} onCastVoiceChange={input.onCastVoiceChange} />
          </span>
        ) : null}
      </div>
      <p className='m-0 max-w-[40em] font-[family-name:var(--dd-font-script)] text-[15px] leading-[1.5] text-[var(--dd-card-fg)]'>{line.plainText}</p>
      <DirectionEditor
        value={input.actingScript}
        onValueChange={input.onActingScriptChange}
        highlight={actingScriptHighlight}
        ariaLabel={`Acting script for line ${line.number}`}
        handleRef={input.editorRef}
        onGenerate={input.onGenerate}
        footer={<>
          <ActingTagChips tags={input.suggestedTags} onInsert={input.onInsertTag} />
          <span className='flex-1' />
          {input.actingScript !== input.agentActingScript ? <DirectionRevertButton onRevert={input.onRevert} /> : null}
        </>}
      />
    </>
  );
}
