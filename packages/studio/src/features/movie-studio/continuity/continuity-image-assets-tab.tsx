import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';
import { useGenerationRequestInspectorDialog } from '@/features/generation-request-inspector/use-generation-request-inspector';
import {
  continuityImageAspectRatio,
  continuityImageAssets,
  continuityImageUrl,
  continuityPreviewImage,
} from './continuity-image-assets';

interface ContinuityImageAssetsTabProps {
  projectName: string;
  assets: StudioAssetResponse[];
  selectedCanonicalAssetId: string | null;
  canonicalType: string;
  sheetTypes: readonly string[];
  canonicalTitle: string;
  canonicalPluralTitle: string;
  sheetTitle: string;
  sheetPluralTitle: string;
  onToggleCanonical: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}

export function ContinuityImageAssetsTab({
  projectName,
  assets,
  selectedCanonicalAssetId,
  canonicalType,
  sheetTypes,
  canonicalTitle,
  canonicalPluralTitle,
  sheetTitle,
  sheetPluralTitle,
  onToggleCanonical,
  onDeleteAsset,
}: ContinuityImageAssetsTabProps) {
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  const canonicalAssets = continuityImageAssets(assets, [canonicalType]);
  const sheetAssets = continuityImageAssets(assets, sheetTypes);
  const cards = (
    entries: StudioAssetResponse[],
    kind: 'canonical' | 'sheet'
  ) =>
    entries.map((asset) => {
      const selected =
        kind === 'canonical' && asset.id === selectedCanonicalAssetId;
      const fallbackTitle = kind === 'canonical' ? canonicalTitle : sheetTitle;
      const imageUrl = continuityImageUrl(projectName, asset);
      const previewImage = continuityPreviewImage(
        projectName,
        asset,
        fallbackTitle
      );
      const activationLabel = asset.oneLineSummary ?? fallbackTitle;
      return {
        id: asset.id,
        card: {
          media: imageUrl
            ? {
                kind: 'image' as const,
                src: imageUrl,
                alt: selected ? `Current ${canonicalTitle.toLowerCase()}` : activationLabel,
                fit: kind === 'canonical' ? ('cover' as const) : ('contain' as const),
                effect: 'zoom-on-hover' as const,
              }
            : null,
          frame: {
            kind: 'ratio' as const,
            aspectRatio: continuityImageAspectRatio(
              asset,
              kind === 'canonical' ? 16 / 9 : 4 / 3
            ),
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
                label: activationLabel,
                image: previewImage,
              }
            : undefined,
          cornerAction: {
            kind: 'inspect' as const,
            label: 'View generation request',
            visibility: 'always' as const,
            onAction: () => {
              const file = continuityImageAssets([asset], [asset.type])[0]?.files.find(
                (candidate) => candidate.mediaKind === 'image'
              );
              if (!file) return;
              openGenerationRequestInspector({
                projectName,
                assetId: asset.id,
                assetFileId: file.id,
              });
            },
          },
          ...(kind === 'canonical'
            ? {
                selection: {
                  kind: 'toggle' as const,
                  selected,
                  selectedLabel: `Clear selected ${canonicalTitle.toLowerCase()}`,
                  unselectedLabel: `Use as ${canonicalTitle.toLowerCase()}`,
                  onToggle: () => onToggleCanonical(asset),
                },
              }
            : {}),
          deleteAction: {
            label: `Delete ${fallbackTitle.toLowerCase()}`,
            confirmationTitle: `Delete ${fallbackTitle}?`,
            confirmationMessage: `Remove this ${fallbackTitle.toLowerCase()}. This cannot be undone.`,
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
          title={canonicalPluralTitle}
          emptyTitle={`No ${canonicalPluralTitle.toLowerCase()} yet.`}
          items={cards(canonicalAssets, 'canonical')}
          minimumCardWidthPx={320}
        />
        <MediaCollectionSection
          title={sheetPluralTitle}
          emptyTitle={`No ${sheetPluralTitle.toLowerCase()} yet.`}
          items={cards(sheetAssets, 'sheet')}
          minimumCardWidthPx={480}
        />
      </div>
    </div>
  );
}
