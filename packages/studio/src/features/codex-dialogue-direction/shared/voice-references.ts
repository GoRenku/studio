import type { DialogueDirectionRoute } from '@gorenku/studio-codex/dialogue-direction';
import type { DirectionMentionColour } from './direction-emphasis';
import type { DirectionCastSpeaker } from './direction-speakers';
import { speakerHue, speakerTextColour } from './speaker-colour';

/** Each Voice Mention in the colour of the speaker at its reference position; none when the selection exceeds the route's voices. */
export function directionMentionColours(route: DialogueDirectionRoute, speakers: DirectionCastSpeaker[]): DirectionMentionColour[] {
  if (route.voiceBinding.kind !== 'voice-references' || !route.voiceBinding.mentions || speakers.length > route.maxVoices) return [];
  const { mentions } = route.voiceBinding;
  return speakers.map((speaker, index) => ({ mention: mentions[index]!, colour: speakerTextColour(speakerHue(speaker.castMemberId, speaker.speakerName)) }));
}

/** The reference position shown on a selected line's avatar in the rail; Speaker Voices show none. */
export function voiceReferenceBadge(route: DialogueDirectionRoute, speakers: DirectionCastSpeaker[], castMemberId: string | null): number | null {
  if (route.voiceBinding.kind !== 'voice-references') return null;
  const index = speakers.findIndex((speaker) => speaker.castMemberId === castMemberId);
  return index >= 0 && index < route.maxVoices ? index + 1 : null;
}
