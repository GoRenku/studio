import type { ReactNode } from 'react';
import type { StoryboardLookbookDefinition } from '@gorenku/studio-core/client';
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
  const canDeleteLookbookImages =
    source.kind === 'lookbook' && Boolean(onDeleteLookbookImage);
  const onDeleteImage = canDeleteLookbookImages
    ? async (image: ReportImage) => {
        if (!image.lookbookImageId || !onDeleteLookbookImage) return;
        await onDeleteLookbookImage(image.lookbookImageId);
      }
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
          onDeleteImage={onDeleteImage}
        />
      ) : (
        <ProductionLookbookReport
          projectName={projectName}
          sections={sections}
          source={source}
          onDeleteImage={onDeleteImage}
        />
      )}
    </LookbookReportFrame>
  );
}

function isStoryboardSections(
  sections: ProductionVisualLanguageSections | StoryboardLookbookDefinition
): sections is StoryboardLookbookDefinition {
  return 'styleBrief' in sections;
}
