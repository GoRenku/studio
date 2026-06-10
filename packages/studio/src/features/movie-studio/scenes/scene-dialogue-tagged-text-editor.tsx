import type { ChangeEvent, ReactNode } from 'react';
import { Textarea } from '@/ui/textarea';
import { cn } from '@/lib/utils';

interface SceneDialogueTaggedTextEditorProps {
  value: string;
  disabled?: boolean;
  highlightTags: boolean;
  label: string;
  onChange: (value: string) => void;
}

const AUDIO_TAG_PATTERN = /\[[^\]\n]{1,48}\]/g;

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
          className='pointer-events-none absolute inset-0 z-10 min-h-36 whitespace-pre-wrap break-words px-3 py-2 text-sm leading-6 text-transparent'
        >
          {renderHighlightedTags(value)}
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
          highlightTags && 'relative z-0'
        )}
      />
    </div>
  );
}

function renderHighlightedTags(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of value.matchAll(AUDIO_TAG_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${key++}`}>{value.slice(lastIndex, index)}</span>
      );
    }
    parts.push(
      <span
        key={`tag-${key++}`}
        className='rounded-sm bg-primary/18 px-0.5 text-primary'
      >
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
