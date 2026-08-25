import { useGenerationRequestInspectorDialog } from '@/features/media-generation-request/use-media-generation-request-inspector';
import { deleteStudioShotPlanImageAsset } from '@/services/studio-shot-plans-api';
import type { StudioShotPlanImageAssets } from '@/services/studio-shot-plans-contracts';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { Button } from '@/ui/button';
import { useShotPlanImageAssets } from './use-shot-plan-image-assets';

const groupLabels: Record<StudioShotPlanImageAssets['groups'][number]['role'], string> = {
  'first-frame': 'First Frames',
  'last-frame': 'Last Frames',
  storyboard: 'Storyboards',
  reference: 'Reference Images',
};

export function ShotPlanImageAssetsView(input: {
  projectName: string;
  shotPlanId: string;
}) {
  const { resource, error, reload } = useShotPlanImageAssets({ ...input, enabled: true });
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  if (error) {
    return (
      <div className='flex h-full flex-col items-start justify-center gap-3 p-8'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button type='button' variant='outline' size='sm' onClick={reload}>Retry</Button>
      </div>
    );
  }
  if (!resource) return <p className='p-8 text-sm text-muted-foreground'>Loading Shot Plan assets...</p>;
  if (resource.groups.length === 0) {
    return <p className='p-8 text-sm text-muted-foreground'>No image assets for this Shot Plan.</p>;
  }
  return (
    <div className='h-full overflow-y-auto p-6'>
      <div className='flex flex-col gap-8'>
        {resource.groups.map((group) => (
          <section key={group.role} className='flex flex-col gap-3'>
            <h3 className='text-sm font-semibold text-foreground'>{groupLabels[group.role]}</h3>
            <MediaCardGrid minimumCardWidthPx={220} gap='standard'>
              {group.assets.map((asset) => {
                const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
                return (
                  <MediaCard
                    key={asset.id}
                    media={file ? {
                      kind: 'image',
                      src: file.url,
                      alt: asset.title,
                      fit: 'cover',
                      effect: 'zoom-on-hover',
                    } : null}
                    frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
                    presentation={{ kind: 'overlay' }}
                    activation={file ? {
                      kind: 'image-preview',
                      label: `Preview ${asset.title}`,
                      image: { src: file.url, alt: asset.title, title: asset.title },
                    } : undefined}
                    cornerAction={asset.generationProvenance ? {
                      kind: 'inspect',
                      label: `Inspect generation request for ${asset.title}`,
                      visibility: 'always',
                      onAction: () => openGenerationRequestInspector({ projectName: input.projectName, assetId: asset.id }),
                    } : undefined}
                    deleteAction={{
                      label: `Delete ${asset.title}`,
                      confirmationTitle: 'Delete Shot Plan Image?',
                      confirmationMessage: 'This image will move to Trash. You can restore it later.',
                      onDelete: async () => {
                        await deleteStudioShotPlanImageAsset({ ...input, assetId: asset.id });
                        reload();
                      },
                    }}
                    emptyState={{ kind: 'image' }}
                  />
                );
              })}
            </MediaCardGrid>
          </section>
        ))}
      </div>
    </div>
  );
}
