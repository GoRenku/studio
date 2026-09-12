import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { LineTabBar } from '@/ui/line-tab-bar';
import { LineTabsContent } from '@/ui/line-tabs';
import { Tabs } from '@/ui/tabs';
import { MediaGenerationConfiguration } from './media-generation-configuration';
import { MediaGenerationPromptEditor } from './media-generation-prompt-editor';
import { MediaGenerationReferenceCard } from './media-generation-reference-card';

export type MediaGenerationRequestTab = 'prompt' | 'references' | 'configuration';

export function MediaGenerationRequestView({
  preview,
  prompt,
  tab,
  onPromptChange,
  onTabChange,
  tabTrailing,
}: {
  preview: MediaGenerationPreviewResource;
  prompt: string | null;
  tab: MediaGenerationRequestTab;
  onPromptChange: (prompt: string) => void;
  onTabChange: (tab: MediaGenerationRequestTab) => void;
  tabTrailing?: React.ReactNode;
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as MediaGenerationRequestTab)}
      className='contents'
    >
      <LineTabBar items={mediaGenerationRequestTabs} trailing={tabTrailing} />
      <div className='flex min-h-0 flex-col overflow-hidden px-6'>
        <LineTabsContent value='prompt' className='mt-0 min-h-0 overflow-hidden'>
          {prompt === null ? (
            <p className='pt-[38px] text-sm text-muted-foreground'>
              This request does not contain a prompt.
            </p>
          ) : (
            <div className='mx-auto h-full min-h-0 w-full max-w-[790px]'>
              <MediaGenerationPromptEditor
                value={prompt}
                onValueChange={onPromptChange}
                readOnly={!preview.editable}
                references={preview.references}
              />
            </div>
          )}
        </LineTabsContent>
        <LineTabsContent value='references' className='mt-0 min-h-0 overflow-auto'>
          {preview.references.length > 0 ? (
            <div className='mx-auto grid w-full max-w-[900px] grid-cols-[repeat(2,minmax(0,420px))] gap-5 pt-[38px] pb-12'>
              {preview.references.map((reference) => (
                <MediaGenerationReferenceCard
                  key={reference.requestPointer}
                  reference={reference}
                />
              ))}
            </div>
          ) : (
            <p className='mx-auto w-full max-w-[900px] pt-[38px] text-sm text-muted-foreground'>
              No local media references.
            </p>
          )}
          {preview.diagnostics.length > 0 ? (
            <div className='mx-auto grid w-full max-w-[790px] gap-3 pb-12'>
              {preview.diagnostics.map((diagnostic, index) => (
                <Alert key={`${diagnostic.code}:${index}`} variant={diagnostic.severity === 'error' ? 'destructive' : 'default'}>
                  <AlertCircle />
                  <AlertTitle>{diagnostic.code}</AlertTitle>
                  <AlertDescription>{diagnostic.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : null}
        </LineTabsContent>
        <LineTabsContent value='configuration' className='mt-0 min-h-0 overflow-auto'>
          <MediaGenerationConfiguration
            provider={preview.provider}
            model={preview.model}
            value={preview.configuration}
          />
        </LineTabsContent>
      </div>
    </Tabs>
  );
}

const mediaGenerationRequestTabs: Array<{
  value: MediaGenerationRequestTab;
  label: string;
}> = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'references', label: 'References' },
  { value: 'configuration', label: 'Configuration' },
];
