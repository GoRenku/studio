import { useState } from 'react';
import { useGenerationRequestInspectorDialog } from '@/features/media-generation-request/use-media-generation-request-inspector';
import { deleteProjectVideoAssetFile } from '@/services/studio-shot-plan-video-generations-api';
import type { StudioShotPlanVideoAssetFile } from '@/services/studio-shot-plan-video-generations-contracts';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { VideoPreviewDialog } from '@/ui/video-preview-dialog';

export function ShotPlanVideoGenerationGroup({
  projectName,
  assetFiles,
  onDeleted,
}: {
  projectName: string;
  assetFiles: StudioShotPlanVideoAssetFile[];
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const { openGenerationRequestInspector } =
    useGenerationRequestInspectorDialog();
  const takes = [...assetFiles]
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
      || right.id.localeCompare(left.id)
    )
    .map((assetFile, index) => ({
      assetFile,
      title: `Take ${assetFiles.length - index}`,
    }));

  return (
    <>
      <MediaCardGrid minimumCardWidthPx={280} gap='roomy'>
        {takes.map(({ assetFile, title }) => {
          return (
            <MediaCard
              key={assetFile.id}
              media={{
                kind: 'video',
                src: assetFile.browserUrl,
                title,
                playback: 'hover-muted',
              }}
              frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
              presentation={{
                kind: 'overlay',
                copy: {
                  title,
                  description: formatCreatedAt(assetFile.createdAt),
                },
              }}
              activation={{
                kind: 'callback',
                label: `Preview ${title}`,
                onActivate: () =>
                  setPreview({ src: assetFile.browserUrl, title }),
              }}
              cornerAction={{
                kind: 'inspect',
                label: 'Inspect generation request',
                visibility: 'hover-or-focus',
                onAction: () =>
                  openGenerationRequestInspector({
                    projectName,
                    assetFileId: assetFile.id,
                  }),
              }}
              deleteAction={{
                label: 'Delete video',
                confirmationTitle: 'Delete video?',
                confirmationMessage:
                  'The video will move to Trash and can be restored later.',
                onDelete: async () => {
                  await deleteProjectVideoAssetFile(projectName, assetFile.id);
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
