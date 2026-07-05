import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { LineTabBar } from '@/ui/line-tab-bar';
import { LineTabsContent } from '@/ui/line-tabs';
import { Tabs } from '@/ui/tabs';
import { GenerationPreviewConfigPanel } from './generation-preview-config-panel';
import { GenerationPreviewDiagnosticsBanner } from './generation-preview-diagnostics-banner';
import { GenerationPreviewPromptPanel } from './generation-preview-prompt-panel';
import { GenerationPreviewReferenceGrid } from './generation-preview-reference-grid';

export type GenerationPreviewTab = 'prompt' | 'references' | 'config';

interface GenerationPreviewTabsProps {
  preview: StudioGenerationPreview;
  tab: GenerationPreviewTab;
  updateError: string | null;
  updatingDependencyId: string | null;
  onTabChange: (tab: GenerationPreviewTab) => void;
  onReferenceToggle: (reference: StudioGenerationPreviewReference) => void;
}

export function GenerationPreviewTabs({
  preview,
  tab,
  updateError,
  updatingDependencyId,
  onTabChange,
  onReferenceToggle,
}: GenerationPreviewTabsProps) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as GenerationPreviewTab)}
      className='contents'
    >
      <LineTabBar items={generationPreviewTabItems} />
      <div className='flex min-h-0 flex-col overflow-hidden px-6 py-4'>
        {updateError ? (
          <Alert variant='destructive' className='mb-4 shrink-0'>
            <AlertCircle />
            <AlertTitle>Preview Update Failed</AlertTitle>
            <AlertDescription>{updateError}</AlertDescription>
          </Alert>
        ) : null}
        <GenerationPreviewDiagnosticsBanner diagnostics={preview.diagnostics} />
        <LineTabsContent value='prompt' className='mt-0 min-h-0 overflow-auto'>
          <GenerationPreviewPromptPanel preview={preview} />
        </LineTabsContent>
        <LineTabsContent
          value='references'
          className='mt-0 min-h-0 overflow-auto'
        >
          <GenerationPreviewReferenceGrid
            preview={preview}
            updatingDependencyId={updatingDependencyId}
            onReferenceToggle={onReferenceToggle}
          />
        </LineTabsContent>
        <LineTabsContent value='config' className='mt-0 min-h-0 overflow-auto'>
          <GenerationPreviewConfigPanel preview={preview} />
        </LineTabsContent>
      </div>
    </Tabs>
  );
}

const generationPreviewTabItems: Array<{
  value: GenerationPreviewTab;
  label: string;
}> = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'references', label: 'References' },
  { value: 'config', label: 'Config' },
];
