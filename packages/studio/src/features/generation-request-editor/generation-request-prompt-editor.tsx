import { useRef, useState } from 'react';
import { Editor, type EditorProps, type PrismEditor } from 'prism-react-editor';
import { insertText } from 'prism-react-editor/utils';
import { BasicSetup } from 'prism-react-editor/setups';
import 'prism-react-editor/prism/languages/markdown';
import 'prism-react-editor/layout.css';
import 'prism-react-editor/search.css';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import '@/styles/prism-renku-dark.css';
import '@/styles/prism-renku-light.css';
import './generation-request-prompt.css';
import {
  filterGenerationPromptMentions,
  generationPromptMentionAtCaret,
  generationPromptMentionQuery,
  type GenerationPromptMentionQuery,
  type GenerationPromptReferenceMention,
} from './generation-request-prompt-mentions';

interface GenerationRequestPromptEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  mentions: GenerationPromptReferenceMention[];
  readOnly?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}

export function GenerationRequestPromptEditor({
  value,
  onValueChange,
  mentions,
  readOnly = false,
  className,
  ariaLabel,
  placeholder,
}: GenerationRequestPromptEditorProps) {
  const [initialValue] = useState(value);
  const [query, setQuery] = useState<GenerationPromptMentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [preview, setPreview] = useState<GenerationPromptReferenceMention | null>(null);
  const editorRef = useRef<PrismEditor | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const options = query ? filterGenerationPromptMentions(mentions, query.query) : [];

  const updateSelection = (caret: number, editor: PrismEditor) => {
    editorRef.current = editor;
    setPreview(generationPromptMentionAtCaret(editor.value, caret, mentions));
    const nextQuery = readOnly
      ? null
      : generationPromptMentionQuery(editor.value, caret);
    setQuery(nextQuery);
    setActiveIndex(0);
  };

  const insertMention = (mention: GenerationPromptReferenceMention) => {
    const editor = editorRef.current;
    if (!editor || !query || readOnly) return;
    insertText(editor, mention.value, query.start, query.end);
    setQuery(null);
    setPreview(mention);
  };

  const textareaProps: EditorProps['textareaProps'] = {
    'aria-label': ariaLabel,
    readOnly,
    spellCheck: true,
    placeholder,
    onKeyDownCapture: (event) => {
      if (!query) return;
      const handled = event.key === 'Escape' ||
        options.length > 0 && [
          'ArrowDown', 'ArrowUp', 'Enter', 'Tab',
        ].includes(event.key);
      if (!handled) return;
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setActiveIndex((current) => event.key === 'ArrowDown'
          ? (current + 1) % options.length
          : (current + options.length - 1) % options.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        insertMention(options[activeIndex] ?? options[0]!);
        return;
      }
      if (event.key === 'Escape') {
        setQuery(null);
      }
    },
  };

  return (
    <div className={cn('relative h-full min-h-0', className)}>
      <div
        ref={surfaceRef}
        className={cn(
          'generation-prompt-surface h-full min-h-0 overflow-hidden bg-transparent text-foreground',
          'prism-light prism-dark',
        )}
        onMouseMove={(event) => {
          const offset = textOffsetAtPoint(
            surfaceRef.current,
            event.clientX,
            event.clientY,
          );
          setPreview(offset === null
            ? null
            : generationPromptMentionAtCaret(
                editorRef.current?.value ?? value,
                offset,
                mentions,
              ));
        }}
        onMouseLeave={() => setPreview(null)}
      >
        <Editor
          language='markdown'
          value={initialValue}
          onUpdate={(nextValue, editor) => {
            editorRef.current = editor;
            onValueChange(nextValue);
          }}
          onSelectionChange={(selection, _nextValue, editor) => {
            const [start, end, direction] = selection;
            updateSelection(direction === 'backward' ? start : end, editor);
          }}
          readOnly={readOnly}
          wordWrap
          lineNumbers={false}
          textareaProps={textareaProps}
          className='generation-prompt-document h-full text-[15px] leading-[1.7]'
        >
          {!readOnly ? <BasicSetup /> : null}
        </Editor>
      </div>
      {query && options.length > 0 ? (
        <div
          role='listbox'
          aria-label='Selected image references'
          className='absolute left-8 top-12 z-30 max-h-64 w-80 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg'
        >
          {options.map((mention, index) => (
            <Button
              key={mention.value}
              type='button'
              variant='ghost'
              role='option'
              aria-selected={index === activeIndex}
              className={cn(
                'h-auto w-full justify-start gap-3 px-2 py-2 text-left',
                index === activeIndex && 'bg-accent',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                setActiveIndex(index);
                setPreview(mention);
              }}
              onClick={() => insertMention(mention)}
            >
              <img
                src={mention.previewImageUrl}
                alt=''
                className='h-10 w-10 rounded object-cover'
              />
              <span className='min-w-0'>
                <span className='block truncate text-sm font-medium'>{mention.label}</span>
                <span className='block font-mono text-xs text-muted-foreground'>{mention.value}</span>
              </span>
            </Button>
          ))}
        </div>
      ) : null}
      {preview ? (
        <div className='pointer-events-none absolute bottom-4 right-4 z-20 w-48 overflow-hidden rounded-md border bg-popover shadow-lg'>
          <img
            src={preview.previewImageUrl}
            alt={preview.label}
            className='aspect-video w-full object-cover'
          />
          <p className='truncate px-2 py-1.5 text-xs font-medium'>{preview.label}</p>
        </div>
      ) : null}
    </div>
  );
}

function textOffsetAtPoint(
  root: HTMLElement | null,
  clientX: number,
  clientY: number,
): number | null {
  if (!root) return null;
  const range = document.caretRangeFromPoint?.(clientX, clientY);
  if (!range || !root.contains(range.startContainer)) return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  return prefix.toString().length;
}
