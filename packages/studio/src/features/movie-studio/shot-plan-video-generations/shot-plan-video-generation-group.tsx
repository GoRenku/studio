import { useState } from 'react';
import { useGenerationRequestInspectorDialog } from '@/features/media-generation-request/use-media-generation-request-inspector';
import { deleteProjectVideoAsset } from '@/services/studio-shot-plan-video-generations-api';
import type { StudioShotPlanVideoAsset } from '@/services/studio-shot-plan-video-generations-contracts';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { VideoPreviewDialog } from '@/ui/video-preview-dialog';

export function ShotPlanVideoGenerationGroup({
  projectName,
  assets,
  onDeleted,
}: {
  projectName: string;
  assets: StudioShotPlanVideoAsset[];
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const { openGenerationRequestInspector } =
    useGenerationRequestInspectorDialog();
  const takes = [...assets]
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
      || right.id.localeCompare(left.id)
    )
    .map((asset, index) => ({
      asset,
      title: `Take ${assets.length - index}`,
    }));

  return (
    <>
      <MediaCardGrid minimumCardWidthPx={280} gap='roomy'>
        {takes.map(({ asset, title }) => {
          const file = asset.files.find((candidate) =>
            candidate.mediaKind === 'video'
          );
          if (!file) {
            return null;
          }
          return (
            <MediaCard
              key={asset.id}
              media={{
                kind: 'video',
                src: file.browserUrl,
                title,
                playback: 'hover-muted',
              }}
              frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
              presentation={{
                kind: 'overlay',
                copy: {
                  title,
                  description: formatCreatedAt(asset.createdAt),
                },
              }}
              activation={{
                kind: 'callback',
                label: `Preview ${title}`,
                onActivate: () =>
                  setPreview({ src: file.browserUrl, title }),
              }}
              cornerAction={{
                kind: 'inspect',
                label: 'Inspect generation request',
                visibility: 'hover-or-focus',
                onAction: () =>
                  openGenerationRequestInspector({
                    projectName,
                    assetId: asset.id,
                  }),
              }}
              deleteAction={{
                label: 'Delete video',
                confirmationTitle: 'Delete video?',
                confirmationMessage:
                  'The video will move to Trash and can be restored later.',
                onDelete: async () => {
                  await deleteProjectVideoAsset(projectName, asset.id);
                  onDeleted();
                },
              }}
            />
          );
        })}
      </MediaCardGrid>
      {preview ? (
        <VideoPreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          src={preview.src}
          title={preview.title}
        />
      ) : null}
    </>
  );
}

function formatCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt));
}
