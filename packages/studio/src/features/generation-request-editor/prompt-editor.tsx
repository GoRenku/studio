import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap, tooltips } from '@codemirror/view';
import { useMemo } from 'react';
import { CodeMirrorEditor } from '@/ui/code-mirror-editor';
import { promptReferenceCompletion } from './prompt-reference-completion';
import { promptReferencePreview } from './prompt-reference-preview';
import { promptTheme } from './prompt-theme';
import type { GenerationPromptReferenceMention } from './prompt-mentions';

export interface PromptEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  mentions: GenerationPromptReferenceMention[];
  readOnly?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}

export function PromptEditor({
  value,
  onValueChange,
  mentions,
  readOnly = false,
  className,
  ariaLabel,
  placeholder,
}: PromptEditorProps) {
  const extensions = useMemo<readonly Extension[]>(() => [
    EditorView.lineWrapping,
    markdown(),
    promptTheme,
    promptReferencePreview(mentions),
    tooltips({
      position: 'fixed',
      tooltipSpace: (view) => {
        const bounds = view.scrollDOM.getBoundingClientRect();
        return {
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          left: bounds.left,
        };
      },
    }),
    ...(readOnly ? [] : [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      promptReferenceCompletion(mentions),
    ]),
  ], [mentions, readOnly]);

  return (
    <CodeMirrorEditor
      value={value}
      onValueChange={onValueChange}
      extensions={extensions}
      readOnly={readOnly}
      className={className}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      spellCheck
    />
  );
}
