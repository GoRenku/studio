import type { ReactNode } from 'react';

export const SCENE_DIALOGUE_AUDIO_TAG_PATTERN = /\[[^\]\n]{1,48}\]/g;

export const SCENE_DIALOGUE_AUDIO_TAG_CLASS_NAME =
  'font-medium text-dialogue-audio-tag';

export function isSceneDialogueAudioTag(value: string): boolean {
  SCENE_DIALOGUE_AUDIO_TAG_PATTERN.lastIndex = 0;
  return SCENE_DIALOGUE_AUDIO_TAG_PATTERN.test(value);
}

export function renderSceneDialogueAudioTaggedText(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  SCENE_DIALOGUE_AUDIO_TAG_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(SCENE_DIALOGUE_AUDIO_TAG_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${key++}`}>{value.slice(lastIndex, index)}</span>
      );
    }
    parts.push(
      <span key={`tag-${key++}`} className={SCENE_DIALOGUE_AUDIO_TAG_CLASS_NAME}>
        {match[0]}
      </span>
    );
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push(<span key={`text-${key++}`}>{value.slice(lastIndex)}</span>);
  }

  return parts;
}
