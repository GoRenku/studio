import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
  GenerationPreviewResource,
  GenerationPreviewReferenceSlot,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GenerationPreviewDraft } from '@/features/generation-preview/generation-preview-draft';
import { GenerationPreviewConfigPanel } from '@/features/generation-preview/generation-preview-config-panel';
import { GenerationPreviewDiagnosticsBanner } from '@/features/generation-preview/generation-preview-diagnostics-banner';
import { GenerationPreviewPromptPanel } from '@/features/generation-preview/generation-preview-prompt-panel';
import { GenerationPreviewReferenceGrid } from '@/features/generation-preview/generation-preview-reference-grid';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { LineTabBar } from '@/ui/line-tab-bar';
import { LineTabsContent } from '@/ui/line-tabs';
import { Tabs } from '@/ui/tabs';
import { GenerationRequestControlsPanel } from './generation-request-controls-panel';

export type GenerationRequestEditorTab = 'prompt' | 'references' | 'config';

interface GenerationRequestEditorProps {
  preview: GenerationPreviewResource | null;
  draft: GenerationPreviewDraft;
  editorRevision: number;
  tab: GenerationRequestEditorTab;
  error: string | null;
  errorTitle: string;
  pending: boolean;
  readOnly?: boolean;
  referencesReadOnly?: boolean;
  controls?: GenerationEditorControl[];
  modelControl?: {
    value: string;
    options: Array<{ value: string; label: string }>;
  };
  onTabChange: (tab: GenerationRequestEditorTab) => void;
  onAuthoredTextChange: (value: string) => void;
  onNegativeTextChange: (value: string) => void;
  onReferenceChoose?: (
    slot: GenerationPreviewReferenceSlot,
    reference: GenerationPreviewResourceReference | null
  ) => void;
  onModelChange?: (value: string) => void;
  onControlChange?: (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => void;
  authoredPlaceholder?: string;
  tabRowTrailing?: ReactNode;
}

export function GenerationRequestEditor({
  preview,
  draft,
  editorRevision,
  tab,
  error,
  errorTitle,
  pending,
  readOnly = false,
  referencesReadOnly = false,
  controls = [],
  modelControl,
  onTabChange,
  onAuthoredTextChange,
  onNegativeTextChange,
  onReferenceChoose,
  onModelChange = () => {},
  onControlChange = () => {},
  authoredPlaceholder,
  tabRowTrailing,
}: GenerationRequestEditorProps) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) =>
        onTabChange(value as GenerationRequestEditorTab)
      }
      className='contents'
    >
      <LineTabBar
        items={generationRequestEditorTabItems}
        trailing={tabRowTrailing}
      />
      <div className='flex min-h-0 flex-col overflow-hidden px-6 py-4'>
        {error ? (
          <Alert variant='destructive' className='mb-4 shrink-0'>
            <AlertCircle />
            <AlertTitle>{errorTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <GenerationPreviewDiagnosticsBanner
          diagnostics={preview?.diagnostics ?? []}
        />
        <LineTabsContent
          value='prompt'
          className='mt-0 min-h-0 overflow-hidden'
        >
          <GenerationPreviewPromptPanel
            authoredText={draft.promptDraft.authoredText}
            negativeText={draft.promptDraft.negativeText}
            editorRevision={editorRevision}
            readOnly={readOnly || pending}
            onAuthoredTextChange={onAuthoredTextChange}
            onNegativeTextChange={onNegativeTextChange}
            authoredPlaceholder={authoredPlaceholder}
          />
        </LineTabsContent>
        <LineTabsContent
          value='references'
          className='mt-0 min-h-0 overflow-auto'
        >
          {preview ? (
            <GenerationPreviewReferenceGrid
              preview={preview}
              draft={draft}
              updating={pending || readOnly}
              editable={!readOnly && !referencesReadOnly}
              onReferenceChoose={onReferenceChoose}
            />
          ) : (
            <p className='text-sm text-muted-foreground'>
              No references are attached to this request.
            </p>
          )}
        </LineTabsContent>
        <LineTabsContent value='config' className='mt-0 min-h-0 overflow-auto'>
          {controls.length || modelControl ? (
            <GenerationRequestControlsPanel
              controls={controls}
              disabled={pending || readOnly}
              model={
                modelControl
                  ? { ...modelControl, onChange: onModelChange }
                  : undefined
              }
              onChange={onControlChange}
            />
          ) : preview ? (
            <GenerationPreviewConfigPanel preview={preview} />
          ) : (
            <p className='text-sm text-muted-foreground'>No settings.</p>
          )}
        </LineTabsContent>
      </div>
    </Tabs>
  );
}

const generationRequestEditorTabItems: Array<{
  value: GenerationRequestEditorTab;
  label: string;
}> = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'references', label: 'References' },
  { value: 'config', label: 'Config' },
];
