import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { CodeMirrorEditor } from '@/ui/code-mirror-editor';
import { markdownCodeEditorTheme } from '@/ui/markdown-code-editor-theme';

export function ShotDescriptionViewer({
  value,
}: {
  value: string;
}) {
  return (
    <div className='h-full min-h-0 overflow-hidden rounded-lg border border-border/50 bg-panel-bg px-6'>
      <CodeMirrorEditor
        value={value}
        onValueChange={() => {}}
        readOnly
        ariaLabel='Shot description'
        extensions={[
          markdown(),
          EditorView.lineWrapping,
          markdownCodeEditorTheme,
        ]}
        className='h-full'
      />
    </div>
  );
}
