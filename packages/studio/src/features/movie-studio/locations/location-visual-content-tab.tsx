import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';
import {
  locationSheetAspectRatio,
  locationSheetAssets,
  locationSheetCompositeUrl,
  locationSheetPreviewImages,
  locationHeroAssets,
} from './location-assets';
import { useGenerationRequestInspectorDialog } from '@/features/generation-request-inspector/use-generation-request-inspector';

interface LocationVisualContentTabProps {
  projectName: string;
  assets: StudioAssetResponse[];
  selectedHeroAssetId: string | null;
  onToggleHeroDisplay: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}

export function LocationVisualContentTab({
  projectName,
  assets,
  selectedHeroAssetId,
  onToggleHeroDisplay,
  onDeleteAsset,
}: LocationVisualContentTabProps) {
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  const sheetAssets = locationSheetAssets(assets);
  const heroAssets = locationHeroAssets(assets);

  const items = sheetAssets.map((asset) => {
    const imageUrl = locationSheetCompositeUrl(
      projectName,
      asset
    );
    const previewImage = locationSheetPreviewImages(projectName, asset)[0];
    return {
      id: asset.id,
      card: {
        media: imageUrl
          ? {
              kind: 'image' as const,
              src: imageUrl,
              alt: asset.oneLineSummary ?? 'Location sheet',
              fit: 'contain' as const,
              effect: 'zoom-on-hover' as const,
            }
          : null,
        frame: {
          kind: 'ratio' as const,
          aspectRatio: locationSheetAspectRatio(asset, 4 / 3),
          detectFromImage: true,
        },
        presentation: {
          kind: 'overlay' as const,
          copy: asset.oneLineSummary
            ? { description: asset.oneLineSummary }
            : undefined,
        },
        activation: previewImage
          ? {
              kind: 'image-preview' as const,
              label: asset.oneLineSummary ?? 'Location sheet',
              image: previewImage,
            }
          : undefined,
        cornerAction: {
          kind: 'inspect' as const,
          label: 'View generation request',
          visibility: 'always' as const,
          onAction: () => {
            const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
            if (!file) return;
            openGenerationRequestInspector({
              projectName,
              assetId: asset.id,
              assetFileId: file.id,
            });
          },
        },
        deleteAction: {
          label: 'Delete location sheet',
          confirmationTitle: 'Delete Location Sheet?',
          confirmationMessage:
            'Remove this location sheet from this location. This cannot be undone.',
          onDelete: () => onDeleteAsset(asset),
        },
        emptyState: { kind: 'image' as const },
      },
    };
  });
  const heroItems = heroAssets.map((asset) => {
    const selected = asset.id === selectedHeroAssetId;
    const imageUrl = locationSheetCompositeUrl(
      projectName,
      asset
    );
    const previewImage = locationSheetPreviewImages(projectName, asset)[0];
    return {
      id: asset.id,
      card: {
        media: imageUrl
          ? {
              kind: 'image' as const,
              src: imageUrl,
              alt: selected ? 'Current location hero' : 'Location hero',
              fit: 'cover' as const,
              effect: 'zoom-on-hover' as const,
            }
          : null,
        frame: {
          kind: 'ratio' as const,
          aspectRatio: locationSheetAspectRatio(asset, 16 / 9),
          detectFromImage: true,
        },
        presentation: { kind: 'overlay' as const },
        activation: previewImage
          ? {
              kind: 'image-preview' as const,
              label: selected ? 'Current location hero' : 'Location hero',
              image: previewImage,
            }
          : undefined,
        selection: {
          kind: 'toggle' as const,
          selected,
          selectedLabel: 'Clear selected location hero',
          unselectedLabel: 'Use as location hero',
          onToggle: () => onToggleHeroDisplay(asset),
        },
        deleteAction: {
          label: 'Delete location hero',
          confirmationTitle: 'Delete Location Hero?',
          confirmationMessage:
            'Remove this hero image from this location. This cannot be undone.',
          onDelete: () => onDeleteAsset(asset),
        },
        emptyState: { kind: 'image' as const },
      },
    };
  });

  return (
    <div className='min-h-full overflow-y-auto bg-panel-bg px-4 py-5'>
      <div className='space-y-8'>
        <MediaCollectionSection
          title='Hero Images'
          emptyTitle='No hero images yet.'
          items={heroItems}
          minimumCardWidthPx={320}
        />
        <MediaCollectionSection
          title='Location Sheets'
          emptyTitle='No location sheets yet.'
          items={items}
          minimumCardWidthPx={480}
        />
      </div>
    </div>
  );
}
