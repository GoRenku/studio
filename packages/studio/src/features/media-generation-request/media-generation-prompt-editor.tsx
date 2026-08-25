import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap, tooltips } from '@codemirror/view';
import type { MediaGenerationReferenceView } from '@gorenku/studio-core/client';
import { useMemo } from 'react';
import { CodeMirrorEditor } from '@/ui/code-mirror-editor';
import type { MediaGenerationPromptMention } from './media-generation-prompt-mentions';
import { mediaGenerationPromptReferenceCompletion } from './media-generation-prompt-reference-completion';
import { mediaGenerationPromptReferencePreview } from './media-generation-prompt-reference-preview';
import { mediaGenerationPromptTheme } from './media-generation-prompt-theme';

export function MediaGenerationPromptEditor({
  value,
  onValueChange,
  readOnly,
  references,
}: {
  value: string;
  onValueChange: (value: string) => void;
  readOnly: boolean;
  references: MediaGenerationReferenceView[];
}) {
  const mentions = useMemo(() => referenceMentions(references), [references]);
  const extensions = useMemo<readonly Extension[]>(() => [
    EditorView.lineWrapping,
    markdown(),
    mediaGenerationPromptTheme,
    mediaGenerationPromptReferencePreview(mentions),
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
      mediaGenerationPromptReferenceCompletion(mentions),
    ]),
  ], [mentions, readOnly]);

  return (
    <CodeMirrorEditor
      value={value}
      onValueChange={onValueChange}
      extensions={extensions}
      readOnly={readOnly}
      className='min-h-0'
      ariaLabel='Media generation prompt'
      spellCheck
    />
  );
}

function referenceMentions(
  references: MediaGenerationReferenceView[],
): MediaGenerationPromptMention[] {
  const counters = { image: 0, video: 0, audio: 0 };
  return references.map((reference) => {
    counters[reference.kind] += 1;
    const value = `@${reference.kind[0]!.toLocaleUpperCase()}${reference.kind.slice(1)}${counters[reference.kind]}`;
    return {
      value,
      accessibleName: reference.projectRelativePath,
      kind: reference.kind,
      ...(reference.kind === 'image' && reference.browserUrl
        ? { previewImageUrl: reference.browserUrl }
        : {}),
    };
  });
}
