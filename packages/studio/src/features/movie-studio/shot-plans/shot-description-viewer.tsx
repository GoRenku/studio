import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { CodeMirrorEditor } from '@/ui/code-mirror-editor';
import { markdownCodeEditorTheme } from '@/ui/markdown-code-editor-theme';
import type { ScreenplayEntityMentionCatalog } from '../screenplay-entity-mentions';
import { shotDescriptionMentions } from './shot-description-mentions';
import { shotDescriptionTheme } from './shot-description-theme';

export function ShotDescriptionViewer({
  value,
  entityMentions,
}: {
  value: string;
  entityMentions: ScreenplayEntityMentionCatalog;
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
          shotDescriptionTheme,
          shotDescriptionMentions(entityMentions),
        ]}
        className='h-full'
      />
    </div>
  );
}
