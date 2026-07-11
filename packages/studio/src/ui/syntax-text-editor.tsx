import { useState } from 'react';
import { Editor } from 'prism-react-editor';
import type { EditorProps } from 'prism-react-editor';
import { BasicSetup } from 'prism-react-editor/setups';
import 'prism-react-editor/prism/languages/json';
import 'prism-react-editor/prism/languages/markdown';
import 'prism-react-editor/layout.css';
import 'prism-react-editor/search.css';
import { cn } from '@/lib/utils';
import '@/styles/prism-renku-dark.css';
import '@/styles/prism-renku-light.css';

export interface SyntaxTextEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  language: 'markdown' | 'json';
  readOnly?: boolean;
  wordWrap?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}

export function SyntaxTextEditor({
  value,
  onValueChange,
  language,
  readOnly = false,
  wordWrap = true,
  className,
  ariaLabel,
  placeholder,
}: SyntaxTextEditorProps) {
  const [initialValue] = useState(value);
  const textareaProps: EditorProps['textareaProps'] = {
    'aria-label': ariaLabel,
    readOnly,
    spellCheck: true,
    placeholder,
  };

  return (
    <div
      className={cn(
        'min-h-0 overflow-hidden rounded-md border border-border/60 bg-editor-bg text-editor-fg shadow-inner focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-ring/60',
        'prism-light prism-dark',
        className
      )}
    >
      <Editor
        language={language}
        value={initialValue}
        onUpdate={onValueChange}
        readOnly={readOnly}
        wordWrap={wordWrap}
        lineNumbers={false}
        textareaProps={textareaProps}
        className="h-full text-sm leading-6"
      >
        {!readOnly ? <BasicSetup /> : null}
      </Editor>
    </div>
  );
}
