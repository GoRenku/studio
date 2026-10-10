import type { DialogueDirectionVoice } from '@gorenku/studio-codex/dialogue-direction';
import type { DirectionCastSpeaker } from '../shared/direction-speakers';
import { SpeakerAvatar } from '../shared/speaker-avatar';
import { SpeakerVoiceSelect } from '../shared/speaker-voice-select';
import type { DirectionMediaLibrary } from '../shared/use-direction-media';

export const SEED_AUDIO_VOICE_REFERENCE_LIMIT = 3;

export function SeedAudioVoiceReferences(input: {
  speakers: DirectionCastSpeaker[];
  voices: Record<string, DialogueDirectionVoice[]>;
  castVoiceIds: Record<string, string>;
  media: DirectionMediaLibrary;
  insertsAudioTags: boolean;
  onInsertAudioTag: (position: number) => void;
  onCastVoiceChange: (castMemberId: string, castVoiceId: string) => void;
}) {
  if (input.speakers.length > SEED_AUDIO_VOICE_REFERENCE_LIMIT) {
    return (
      <p role='status' className='m-0 rounded-[10px] border border-[var(--dd-active-border)] bg-[var(--dd-active)] px-3 py-2.5 text-xs'>
        Seed Audio takes up to three voices. Select fewer lines.
      </p>
    );
  }
  return (
    <div className='flex flex-wrap items-center gap-x-[18px] gap-y-2'>
      {input.speakers.map((speaker, index) => {
        const position = index + 1;
        const castVoiceId = input.castVoiceIds[speaker.castMemberId];
        return (
          <span key={speaker.castMemberId} className='flex items-center gap-2'>
            <SpeakerAvatar
              speaker={speaker}
              media={input.media}
              badge={position}
              onActivate={input.insertsAudioTags ? () => input.onInsertAudioTag(position) : undefined}
              activateLabel={input.insertsAudioTags ? `Insert @Audio${position}` : undefined}
            />
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
  );
}
