import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';

export function ProjectCoverCards({
  assetFiles,
  selectedAssetFileId,
  onToggleSelected,
  onDelete,
}: {
  assetFiles: StudioAssetFileResponse[];
  selectedAssetFileId: string | null;
  onToggleSelected: (assetFile: StudioAssetFileResponse) => Promise<void>;
  onDelete: (assetFile: StudioAssetFileResponse) => Promise<void>;
}) {
  const items = assetFiles.map((assetFile) => {
    const file = projectCoverPrimaryImage(assetFile);
    const selected = assetFile.id === selectedAssetFileId;
    const label = assetFile.oneLineSummary?.trim() || (assetFile.title ?? '').trim() || 'Project cover';
    return {
      id: assetFile.id,
      card: {
        media: file
          ? {
              kind: 'image' as const,
              src: file.url,
              alt: label,
              fit: 'cover' as const,
              loading: 'lazy' as const,
              effect: 'zoom-on-hover' as const,
            }
          : null,
        frame: { kind: 'ratio' as const, aspectRatio: 16 / 9 },
        presentation: {
          kind: 'overlay' as const,
          copy: assetFile.oneLineSummary
            ? { description: assetFile.oneLineSummary }
            : undefined,
        },
        activation: file
          ? {
              kind: 'image-preview' as const,
              label,
              image: { src: file.url, alt: label, title: label },
            }
          : undefined,
        selection: {
          kind: 'toggle' as const,
          selected,
          selectedLabel: 'Clear active Project cover',
          unselectedLabel: 'Use as active Project cover',
          onToggle: () => onToggleSelected(assetFile),
        },
        deleteAction: {
          label: 'Move Project cover to Trash',
          confirmationTitle: 'Move Project cover to Trash?',
          confirmationMessage:
            'Move this Project cover to Trash. It can be restored later.',
          deleteLabel: 'Move to Trash',
          onDelete: () => onDelete(assetFile),
        },
        emptyState: { kind: 'image' as const },
      },
    };
  });

  return (
    <MediaCollectionSection
      title='Project Covers'
      emptyTitle='No project covers yet.'
      items={items}
      minimumCardWidthPx={320}
      gap='standard'
    />
  );
}

function projectCoverPrimaryImage(assetFile: StudioAssetFileResponse) {
  return assetFile ?? null;
}
