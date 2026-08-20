import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';

export function ProjectCoverCards({
  assets,
  selectedAssetId,
  onToggleSelected,
  onDelete,
}: {
  assets: StudioAssetResponse[];
  selectedAssetId: string | null;
  onToggleSelected: (asset: StudioAssetResponse) => Promise<void>;
  onDelete: (asset: StudioAssetResponse) => Promise<void>;
}) {
  const items = assets.map((asset) => {
    const file = projectCoverPrimaryImage(asset);
    const selected = asset.id === selectedAssetId;
    const label = asset.oneLineSummary?.trim() || asset.title.trim() || 'Project cover';
    return {
      id: asset.id,
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
          copy: asset.oneLineSummary
            ? { description: asset.oneLineSummary }
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
          onToggle: () => onToggleSelected(asset),
        },
        deleteAction: {
          label: 'Move Project cover to Trash',
          confirmationTitle: 'Move Project cover to Trash?',
          confirmationMessage:
            'Move this Project cover to Trash. It can be restored later.',
          deleteLabel: 'Move to Trash',
          onDelete: () => onDelete(asset),
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

function projectCoverPrimaryImage(asset: StudioAssetResponse) {
  return asset.files.find(
    (file) => file.role === 'primary' && file.mediaKind === 'image'
  ) ?? null;
}
