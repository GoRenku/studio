import type { Clip } from '@gorenku/studio-core';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import { MarkdownAssetEditor } from '../markdown-asset-editor';

interface ClipDesignPanelProps {
  projectName: string;
  clip: Clip;
  onProjectChange: (project: ProjectShellWithHttp) => void;
}

export function ClipDesignPanel({
  projectName,
  clip,
  onProjectChange,
}: ClipDesignPanelProps) {
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 xl:grid-cols-2'>
        <MarkdownAssetEditor
          projectName={projectName}
          label='Clip Brief'
          asset={clip.summaryAsset}
          initialContent={clip.summary ?? ''}
          emptyMessage='No editable clip brief asset is attached yet.'
          minHeightClassName='min-h-40'
          onProjectChange={onProjectChange}
        />
        <MarkdownAssetEditor
          projectName={projectName}
          label='Visual Intent'
          asset={clip.visualIntentAsset}
          initialContent={clip.visualIntent ?? ''}
          emptyMessage='No editable visual intent asset is attached yet.'
          minHeightClassName='min-h-40'
          onProjectChange={onProjectChange}
        />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-3 gap-3'>
        {['Design References', 'Shot Design', 'Motion Design'].map((stage) => (
          <section
            key={stage}
            className='overflow-hidden rounded-lg border border-border/40 bg-card shadow-lg'
          >
            <div className='h-[42px] border-b border-border/40 bg-muted/35 px-4 flex items-center'>
              <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
                {stage}
              </h3>
            </div>
            <div className='p-4 space-y-3'>
              <div className='flex aspect-video items-center justify-center rounded-md border border-border/40 bg-muted/40 text-xs text-muted-foreground'>
                Empty
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
