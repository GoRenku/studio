import type { DialogueDirectionRoute, DialogueDirectionVoice } from '@gorenku/studio-codex/dialogue-direction';
import type { PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { directionVoiceLimitNotice } from './direction-disclosure';
import type { DirectionCastSpeaker } from './direction-speakers';
import { SpeakerAvatar } from './speaker-avatar';
import { SpeakerVoiceSelect } from './speaker-voice-select';

/**
 * One voice per speaker in the selection. Voice References add their position as a badge and,
 * when the route has Voice Mentions, insert the exact mention text from the avatar.
 */
export function SpeakerVoiceRow(input: {
  route: DialogueDirectionRoute;
  speakers: DirectionCastSpeaker[];
  voices: Record<string, DialogueDirectionVoice[]>;
  castVoiceIds: Record<string, string>;
  media: PanelMediaLibrary;
  onInsertMention: (mention: string) => void;
  onCastVoiceChange: (castMemberId: string, castVoiceId: string) => void;
}) {
  if (input.speakers.length > input.route.maxVoices) {
    return (
      <p role='status' className='m-0 rounded-[10px] border border-[var(--dd-active-border)] bg-[var(--dd-active)] px-3 py-2.5 text-xs'>
        {directionVoiceLimitNotice(input.route)}
      </p>
    );
  }
  const binding = input.route.voiceBinding;
  return (
    <div className='flex flex-wrap items-center gap-x-[18px] gap-y-2'>
      {input.speakers.map((speaker, index) => {
        const mention = binding.kind === 'voice-references' ? binding.mentions?.[index] : undefined;
        const castVoiceId = input.castVoiceIds[speaker.castMemberId];
        return (
          <span key={speaker.castMemberId} className='flex items-center gap-2'>
            <SpeakerAvatar
              speaker={speaker}
              media={input.media}
              badge={binding.kind === 'voice-references' ? index + 1 : null}
              onActivate={mention ? () => input.onInsertMention(mention) : undefined}
              activateLabel={mention ? `Insert ${mention}` : undefined}
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

