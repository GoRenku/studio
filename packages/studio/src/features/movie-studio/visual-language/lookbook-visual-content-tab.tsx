import { useState } from 'react';
import type {
  LookbookImage,
  LookbookResource,
  LookbookSheet,
} from '@gorenku/studio-core/client';
import { MediaCollectionSection } from '@/ui/media-collection-section';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { useImageRevisionDialog } from '@/features/image-revision/use-image-revision-dialog';
import {
  lookbookImageFileUrl,
  lookbookSheetFileUrl,
} from './visual-language-image-urls';

interface LookbookVisualContentTabProps {
  projectName: string;
  resource: LookbookResource;
  onDeleteImage: (imageId: string) => Promise<void>;
  onDeleteSheet: (sheetId: string) => Promise<void>;
}

export function LookbookVisualContentTab({
  projectName,
  resource,
  onDeleteImage,
  onDeleteSheet,
}: LookbookVisualContentTabProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const { openImageRevision } = useImageRevisionDialog();

  const openPreview = (images: PreviewImage[]) => {
    if (!images.length) return;
    setPreviewImages(images);
    setPreviewIndex(0);
  };

  const closePreviewForResourceId = (resourceId: string) => {
    setPreviewImages((current) =>
      current.some((image) => image.src.includes(encodeURIComponent(resourceId)))
        ? []
        : current
    );
    setPreviewIndex(0);
  };

  return (
    <>
      <div className='min-h-full overflow-y-auto bg-panel-bg px-4 py-5'>
        <div className='space-y-8'>
          <MediaCollectionSection
            title='Sample Images'
            emptyTitle='No sample images yet.'
            items={resource.images.map((image) => {
              const previewImagesForImage = lookbookImagePreviewImages(
                projectName,
                image
              );
              const imageUrl = previewImagesForImage[0]?.src ?? null;
              return {
                id: image.id,
                card: {
                  media: imageUrl
                    ? {
                        kind: 'image' as const,
                        src: imageUrl,
                        alt: image.asset.title,
                        fit: 'cover' as const,
                        effect: 'zoom-on-hover' as const,
                      }
                    : null,
                  frame: {
                    kind: 'ratio' as const,
                    aspectRatio: lookbookImageAspectRatio(image, 16 / 10),
                    detectFromImage: true,
                  },
                  presentation: { kind: 'overlay' as const },
                  activation: {
                    label: image.asset.title,
                    onActivate: () => openPreview(previewImagesForImage),
                  },
                  editAction: {
                    label: 'Edit image',
                    onEdit: () => {
                      const file = image.asset.files.find(
                        (candidate) => candidate.mediaKind === 'image'
                      );
                      if (!file) return;
                      openImageRevision({
                        projectName,
                        target: {
                          kind: 'lookbookImage',
                          lookbookId: resource.lookbook.id,
                          imageId: image.id,
                          assetId: image.asset.assetId,
                          assetFileId: file.id,
                        },
                      });
                    },
                  },
                  deleteAction: {
                    label: 'Delete image',
                    confirmationTitle: 'Delete Image?',
                    confirmationMessage:
                      'Remove this image from the lookbook. This cannot be undone.',
                    onDelete: async () => {
                      await onDeleteImage(image.id);
                      closePreviewForResourceId(image.id);
                    },
                  },
                  emptyState: { kind: 'image' as const },
                },
              };
            })}
            minimumCardWidthPx={300}
          />
          <MediaCollectionSection
            title='Lookbook Sheets'
            emptyTitle='No lookbook sheets yet.'
            items={resource.sheets.map((sheet) => {
              const previewImagesForSheet = lookbookSheetPreviewImages(
                projectName,
                sheet
              );
              const imageUrl = previewImagesForSheet[0]?.src ?? null;
              return {
                id: sheet.id,
                card: {
                  media: imageUrl
                    ? {
                        kind: 'image' as const,
                        src: imageUrl,
                        alt: 'Lookbook sheet',
                        fit: 'contain' as const,
                        effect: 'zoom-on-hover' as const,
                      }
                    : null,
                  frame: {
                    kind: 'ratio' as const,
                    aspectRatio: lookbookSheetAspectRatio(sheet, 4 / 3),
                    detectFromImage: true,
                  },
                  presentation: { kind: 'overlay' as const },
                  activation: {
                    label: 'Lookbook sheet',
                    onActivate: () => openPreview(previewImagesForSheet),
                  },
                  editAction: {
                    label: 'Edit image',
                    onEdit: () => {
                      const file = sheet.asset.files.find(
                        (candidate) => candidate.mediaKind === 'image'
                      );
                      if (!file) return;
                      openImageRevision({
                        projectName,
                        target: {
                          kind: 'lookbookSheet',
                          lookbookId: resource.lookbook.id,
                          sheetId: sheet.id,
                          assetId: sheet.asset.assetId,
                          assetFileId: file.id,
                        },
                      });
                    },
                  },
                  deleteAction: {
                    label: 'Delete lookbook sheet',
                    confirmationTitle: 'Delete Lookbook Sheet?',
                    confirmationMessage:
                      'Remove this lookbook sheet from the lookbook. This cannot be undone.',
                    onDelete: async () => {
                      await onDeleteSheet(sheet.id);
                      closePreviewForResourceId(sheet.id);
                    },
                  },
                  emptyState: { kind: 'image' as const },
                },
              };
            })}
            minimumCardWidthPx={480}
          />
        </div>
      </div>
      <ImagePreviewDialog
        images={previewImages}
        currentIndex={previewIndex}
        onCurrentIndexChange={setPreviewIndex}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImages([]);
            setPreviewIndex(0);
          }
        }}
      />
    </>
  );
}

function lookbookImagePreviewImages(
  projectName: string,
  image: LookbookImage
): PreviewImage[] {
  return image.asset.files
    .filter((file) => file.mediaKind === 'image')
    .map((file) => ({
      src: lookbookImageFileUrl(projectName, image.id, file.id),
      alt: image.asset.title,
      title: image.asset.title,
    }));
}

function lookbookSheetPreviewImages(
  projectName: string,
  sheet: LookbookSheet
): PreviewImage[] {
  return sheet.asset.files
    .filter((file) => file.mediaKind === 'image')
    .map((file) => ({
      src: lookbookSheetFileUrl(projectName, sheet.id, file.id),
      alt: sheet.asset.title,
      title: sheet.asset.title,
    }));
}

function lookbookImageAspectRatio(
  image: LookbookImage,
  fallback: number
): number {
  const file = image.asset.files.find((candidate) => candidate.mediaKind === 'image');
  return file?.width && file.height ? file.width / file.height : fallback;
}

function lookbookSheetAspectRatio(
  sheet: LookbookSheet,
  fallback: number
): number {
  const file = sheet.asset.files.find((candidate) => candidate.mediaKind === 'image');
  return file?.width && file.height ? file.width / file.height : fallback;
}
