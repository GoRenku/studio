import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';
import { useGenerationRequestInspectorDialog } from '@/features/media-generation-request/use-media-generation-request-inspector';
import {
  continuityImageAspectRatio,
  continuityImageAssetFiles,
  continuityImageUrl,
  continuityPreviewImage,
} from './continuity-image-assets';

interface ContinuityImageAssetFilesTabProps {
  projectName: string;
  assetFiles: StudioAssetFileResponse[];
  selectedCanonicalAssetFileId: string | null;
  canonicalType: string;
  sheetTypes: readonly string[];
  canonicalTitle: string;
  canonicalPluralTitle: string;
  sheetTitle: string;
  sheetPluralTitle: string;
  onToggleCanonical: (assetFile: StudioAssetFileResponse) => Promise<void>;
  onDeleteAssetFile: (assetFile: StudioAssetFileResponse) => Promise<void>;
}

export function ContinuityImageAssetFilesTab({
  projectName,
  assetFiles,
  selectedCanonicalAssetFileId,
  canonicalType,
  sheetTypes,
  canonicalTitle,
  canonicalPluralTitle,
  sheetTitle,
  sheetPluralTitle,
  onToggleCanonical,
  onDeleteAssetFile,
}: ContinuityImageAssetFilesTabProps) {
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  const canonicalAssetFiles = continuityImageAssetFiles(assetFiles, [canonicalType]);
  const sheetAssetFiles = continuityImageAssetFiles(assetFiles, sheetTypes);
  const cards = (
    entries: StudioAssetFileResponse[],
    kind: 'canonical' | 'sheet'
  ) =>
    entries.map((assetFile) => {
      const selected =
        kind === 'canonical' && assetFile.id === selectedCanonicalAssetFileId;
      const fallbackTitle = kind === 'canonical' ? canonicalTitle : sheetTitle;
      const imageUrl = continuityImageUrl(projectName, assetFile);
      const previewImage = continuityPreviewImage(
        projectName,
        assetFile,
        fallbackTitle
      );
      const activationLabel = assetFile.oneLineSummary ?? fallbackTitle;
      return {
        id: assetFile.id,
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
              assetFile,
              kind === 'canonical' ? 16 / 9 : 4 / 3
            ),
            detectFromImage: true,
          },
          presentation: {
            kind: 'overlay' as const,
            copy: assetFile.oneLineSummary
              ? { description: assetFile.oneLineSummary }
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
              const file = continuityImageAssetFiles([assetFile], [assetFile.type])[0];
              if (!file) return;
              openGenerationRequestInspector({
                projectName,
                assetFileId: assetFile.id,
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
                  onToggle: () => onToggleCanonical(assetFile),
                },
              }
            : {}),
          deleteAction: {
            label: `Delete ${fallbackTitle.toLowerCase()}`,
            confirmationTitle: `Delete ${fallbackTitle}?`,
            confirmationMessage: `Remove this ${fallbackTitle.toLowerCase()}. This cannot be undone.`,
            onDelete: () => onDeleteAssetFile(assetFile),
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
          items={cards(canonicalAssetFiles, 'canonical')}
          minimumCardWidthPx={320}
        />
        <MediaCollectionSection
          title={sheetPluralTitle}
          emptyTitle={`No ${sheetPluralTitle.toLowerCase()} yet.`}
          items={cards(sheetAssetFiles, 'sheet')}
          minimumCardWidthPx={480}
        />
      </div>
    </div>
  );
}
