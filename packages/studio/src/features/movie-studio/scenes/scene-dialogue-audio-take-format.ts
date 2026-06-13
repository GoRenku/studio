import type { SceneDialogueAudioTakeWithUrl } from '@/services/studio-scene-dialogue-audio-api';

export function sceneDialogueAudioTakeLabels(
  takes: SceneDialogueAudioTakeWithUrl[]
): Map<string, string> {
  const sorted = [...takes].sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.takeId.localeCompare(right.takeId)
  );
  return new Map(
    sorted.map((take, index) => [take.takeId, `Take ${index + 1}`])
  );
}

export function formatSceneDialogueAudioTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Generated';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatSceneDialogueAudioDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
