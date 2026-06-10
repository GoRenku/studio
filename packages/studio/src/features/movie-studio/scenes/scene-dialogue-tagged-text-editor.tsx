import type { ChangeEvent } from 'react';
import { Textarea } from '@/ui/textarea';
import { cn } from '@/lib/utils';
import { renderSceneDialogueAudioTaggedText } from './scene-dialogue-audio-tags';

interface SceneDialogueTaggedTextEditorProps {
  value: string;
  disabled?: boolean;
  highlightTags: boolean;
  label: string;
  onChange: (value: string) => void;
}

export function SceneDialogueTaggedTextEditor({
  value,
  disabled = false,
  highlightTags,
  label,
  onChange,
}: SceneDialogueTaggedTextEditorProps) {
  return (
    <div className='relative'>
      {highlightTags ? (
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 z-10 min-h-36 whitespace-pre-wrap break-words px-3 py-2 text-sm leading-6 text-foreground'
        >
          {renderSceneDialogueAudioTaggedText(value)}
        </div>
      ) : null}
      <Textarea
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        className={cn(
          'min-h-36 resize-none bg-transparent leading-6',
          highlightTags && 'relative z-0 text-transparent caret-foreground'
        )}
      />
    </div>
  );
}
