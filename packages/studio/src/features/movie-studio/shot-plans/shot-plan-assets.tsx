import { useGenerationRequestInspectorDialog } from '@/features/media-generation-request/use-media-generation-request-inspector';
import { useState } from 'react';
import { VideoPreviewDialog } from '@/ui/video-preview-dialog';
import type { MediaCardActivation, MediaCardMedia } from '@/ui/media-card/media-card-contract';
import { deleteStudioShotPlanAsset } from '@/services/studio-shot-plans-api';
import type { StudioShotPlanAssets } from '@/services/studio-shot-plans-contracts';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { Button } from '@/ui/button';
import { useShotPlanAssets } from './use-shot-plan-assets';

const groupLabels: Record<StudioShotPlanAssets['groups'][number]['role'], string> = {
  'first-frame': 'First Frames',
  'last-frame': 'Last Frames',
  storyboard: 'Storyboards',
  reference: 'References',
};

export function ShotPlanAssetsView(input: {
  projectName: string;
  shotPlanId: string;
}) {
  const { resource, error, reload } = useShotPlanAssets({ ...input, enabled: true });
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  const [video, setVideo] = useState<{ src: string; title: string } | null>(null);
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
    return <p className='p-8 text-sm text-muted-foreground'>No assets for this Shot Plan.</p>;
  }
  return (
    <div className='h-full overflow-y-auto p-6'>
      <div className='flex flex-col gap-8'>
        {resource.groups.map((group) => (
          <section key={group.role} className='flex flex-col gap-3'>
            <h3 className='text-sm font-semibold text-foreground'>{groupLabels[group.role]}</h3>
            <MediaCardGrid minimumCardWidthPx={220} gap='standard'>
              {group.assets.map((asset) => {
                const file = asset.files.find((candidate) => candidate.role === 'primary');
                const media = file ? planReferenceMedia(file.mediaKind, file.url, asset.title) : null;
                return (
                  <MediaCard
                    key={asset.id}
                    media={media}
                    frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
                    presentation={{ kind: 'overlay' }}
                    activation={planReferenceActivation(media, asset.title, setVideo)}
                    cornerAction={asset.generationProvenance ? {
                      kind: 'inspect',
                      label: `Inspect generation request for ${asset.title}`,
                      visibility: 'always',
                      onAction: () => openGenerationRequestInspector({ projectName: input.projectName, assetId: asset.id }),
                    } : undefined}
                    deleteAction={{
                      label: `Delete ${asset.title}`,
                      confirmationTitle: 'Delete Shot Plan Asset?',
                      confirmationMessage: 'This asset will move to Trash. You can restore it later.',
                      onDelete: async () => {
                        await deleteStudioShotPlanAsset({ ...input, assetId: asset.id });
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
      {video ? <VideoPreviewDialog open src={video.src} title={video.title} onOpenChange={(open) => { if (!open) setVideo(null); }} /> : null}
    </div>
  );
}

function planReferenceMedia(kind: string, src: string, title: string): MediaCardMedia | null {
  switch (kind) {
    case 'image': return { kind, src, alt: title, fit: 'cover', effect: 'zoom-on-hover' };
    case 'video': return { kind, src, title, playback: 'hover-muted' };
    case 'audio': return { kind, src, title };
    default: return null;
  }
}

function planReferenceActivation(
  media: MediaCardMedia | null,
  title: string,
  openVideo: (video: { src: string; title: string }) => void,
): MediaCardActivation | undefined {
  if (media?.kind === 'image') {
    return { kind: 'image-preview', label: `Preview ${title}`, image: { src: media.src, alt: title, title } };
  }
  if (media?.kind === 'video') {
    return { kind: 'callback', label: `Preview ${title}`, onActivate: () => openVideo({ src: media.src, title }) };
  }
  return undefined;
}
