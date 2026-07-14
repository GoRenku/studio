import { useState, type ReactNode } from 'react';
import type { StoryboardLookbookDefinition } from '@gorenku/studio-core/client';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import {
  LookbookReportFrame,
  LookbookReportHeader,
} from './lookbook-report-shared';
import type {
  LookbookReportSource,
  ReportImage,
} from './lookbook-report-images';
import {
  ProductionLookbookReport,
  type ProductionVisualLanguageSections,
} from './production-lookbook-report';
import { StoryboardLookbookReport } from './storyboard-lookbook-report';

interface VisualLanguageReportProps {
  projectName: string;
  title?: string;
  headerMeta?: ReactNode;
  action?: ReactNode;
  onDeleteLookbookImage?: (imageId: string) => Promise<void>;
  sections: ProductionVisualLanguageSections | StoryboardLookbookDefinition;
  source: LookbookReportSource;
}

export function VisualLanguageReport({
  projectName,
  title,
  headerMeta,
  action,
  sections,
  source,
  onDeleteLookbookImage,
}: VisualLanguageReportProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(
    null
  );
  const [deleteImage, setDeleteImage] = useState<ReportImage | null>(null);
  const canDeleteLookbookImages =
    source.kind === 'lookbook' && Boolean(onDeleteLookbookImage);
  const onRequestDeleteImage = canDeleteLookbookImages
    ? setDeleteImage
    : undefined;

  return (
    <LookbookReportFrame hasHeader={Boolean(title || headerMeta || action)}>
      <LookbookReportHeader
        title={title}
        headerMeta={headerMeta}
        action={action}
      />
      {isStoryboardSections(sections) ? (
        <StoryboardLookbookReport
          projectName={projectName}
          sections={sections}
          source={source}
          onOpenImage={setPreviewImage}
          onRequestDeleteImage={onRequestDeleteImage}
        />
      ) : (
        <ProductionLookbookReport
          projectName={projectName}
          sections={sections}
          source={source}
          onOpenImage={setPreviewImage}
          onRequestDeleteImage={onRequestDeleteImage}
        />
      )}
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteImage)}
        onOpenChange={(open) => !open && setDeleteImage(null)}
        title='Delete Image?'
        message='Remove this image from the lookbook. This cannot be undone.'
        onDelete={async () => {
          if (!deleteImage?.lookbookImageId || !onDeleteLookbookImage) return;
          await onDeleteLookbookImage(deleteImage.lookbookImageId);
          setDeleteImage(null);
          if (previewImage?.src === deleteImage.src) {
            setPreviewImage(null);
          }
        }}
      />
    </LookbookReportFrame>
  );
}

function isStoryboardSections(
  sections: ProductionVisualLanguageSections | StoryboardLookbookDefinition
): sections is StoryboardLookbookDefinition {
  return 'styleBrief' in sections;
}
