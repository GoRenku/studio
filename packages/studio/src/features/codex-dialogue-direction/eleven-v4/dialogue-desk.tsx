import type { DialogueDirectionLine, DialogueDirectionVoice } from '@gorenku/studio-codex/dialogue-direction';
import { DirectionEditor, type DirectionEditorHandle } from '../shared/direction-editor';
import { DirectionRevertButton } from '../shared/direction-revert-button';
import type { DirectionCastSpeaker } from '../shared/direction-speakers';
import { SpeakerAvatar } from '../shared/speaker-avatar';
import { SpeakerVoiceSelect } from '../shared/speaker-voice-select';
import type { DirectionMediaLibrary } from '../shared/use-direction-media';
import { ActingTagChips } from './acting-tag-chips';
import { actingScriptHighlight } from './acting-script-highlight';

export function DialogueDesk(input: {
  lines: DialogueDirectionLine[];
  speakers: DirectionCastSpeaker[];
  voices: Record<string, DialogueDirectionVoice[]>;
  castVoiceIds: Record<string, string>;
  media: DirectionMediaLibrary;
  actingScripts: Record<number, string>;
  agentActingScripts: Record<number, string>;
  suggestedTags: string[];
  registerEditor: (line: number, handle: DirectionEditorHandle | null) => void;
  onEditorFocus: (line: number) => void;
  onCastVoiceChange: (castMemberId: string, castVoiceId: string) => void;
  onActingScriptChange: (line: number, actingScript: string) => void;
  onRevert: (line: number) => void;
  onInsertTag: (tag: string) => void;
  onGenerate: () => void;
}) {
  return (
    <>
      <div className='flex flex-wrap items-center gap-x-[18px] gap-y-2'>
        {input.speakers.map((speaker) => {
          const castVoiceId = input.castVoiceIds[speaker.castMemberId];
          return (
            <span key={speaker.castMemberId} className='flex items-center gap-2'>
              <SpeakerAvatar speaker={speaker} media={input.media} />
              <b className='text-xs uppercase tracking-[0.04em]'>{speaker.speakerName}</b>
              {castVoiceId ? (
                <SpeakerVoiceSelect
                  speakerName={speaker.speakerName}
                  voices={input.voices[speaker.castMemberId] ?? []}
                  castVoiceId={castVoiceId}
                  media={input.media}
                  onCastVoiceChange={(next) => input.onCastVoiceChange(speaker.castMemberId, next)}
                />
              ) : null}
            </span>
          );
        })}
      </div>
      <div className='flex flex-col gap-3.5'>
        {input.lines.map((line) => {
          const actingScript = input.actingScripts[line.number] ?? '';
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
                value={actingScript}
                onValueChange={(next) => input.onActingScriptChange(line.number, next)}
                highlight={actingScriptHighlight}
                ariaLabel={`Acting script for line ${line.number}`}
                handleRef={(handle) => input.registerEditor(line.number, handle)}
                onFocus={() => input.onEditorFocus(line.number)}
                onGenerate={input.onGenerate}
                footer={actingScript !== (input.agentActingScripts[line.number] ?? '') ? <>
                  <span className='flex-1' />
                  <DirectionRevertButton onRevert={() => input.onRevert(line.number)} />
                </> : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className='flex flex-wrap gap-1.5'>
        <ActingTagChips tags={input.suggestedTags} onInsert={input.onInsertTag} />
      </div>
    </>
  );
}
