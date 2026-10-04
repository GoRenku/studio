import type {
  InspirationFolderResource,
  LookbookImage,
  LookbookSection,
} from '@gorenku/studio-core/client';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';

export interface ReportImage {
  id: string;
  src: string;
  title: string;
  alt: string;
  lookbookImageId?: string;
}

export type LookbookReportSource =
  | {
      kind: 'inspiration';
      folder: InspirationFolderResource['folder'];
      images: InspirationFolderResource['images'];
    }
  | {
      kind: 'lookbook';
      imagesBySection: Record<LookbookSection, LookbookImage[]>;
      imagesByPoint: Record<string, LookbookImage[]>;
    };

export function imagesForNestedReferences(
  projectName: string,
  source: LookbookReportSource,
  point: { id?: string; imageFiles?: string[] }
): ReportImage[] {
  if (source.kind === 'inspiration') {
    return inspirationImagesToReportImages(projectName, source, point.imageFiles ?? []);
  }
  if (!point.id) return [];
  return lookbookImagesToReportImages(
    projectName,
    source.imagesByPoint[point.id] ?? []
  );
}

export function imagesForSection(
  projectName: string,
  source: LookbookReportSource,
  section: LookbookSection,
  imageFiles: string[] = []
): ReportImage[] {
  if (source.kind === 'inspiration') {
    return inspirationImagesToReportImages(projectName, source, imageFiles);
  }
  return lookbookImagesToReportImages(
    projectName,
    source.imagesBySection[section] ?? []
  );
}

function inspirationImagesToReportImages(
  projectName: string,
  source: Extract<LookbookReportSource, { kind: 'inspiration' }>,
  imageFiles: string[]
): ReportImage[] {
  return imageFiles.flatMap((fileName) => {
    const file = source.images.find((image) =>
      image.projectRelativePath === `${source.folder.projectRelativePath}/${fileName}`
    );
    if (!file) return [];
    return [{
      id: file.id,
      src: projectAssetFileUrl(projectName, file.id),
      alt: `${fileName} inspiration grab`,
      title: fileName,
    }];
  });
}

function lookbookImagesToReportImages(
  projectName: string,
  images: LookbookImage[]
): ReportImage[] {
  return images.flatMap((image) => {
    const file = image.assetFile;
    if (!file) return [];
    return [
      {
        id: image.id,
        src: projectAssetFileUrl(projectName, file.id),
        alt: (image.assetFile.title ?? ''),
        title: (image.assetFile.title ?? ''),
        lookbookImageId: image.id,
      },
    ];
  });
}

export function readableImageTitle(image: ReportImage): string {
  if (image.lookbookImageId) {
    return humanizeTitle(image.title);
  }
  return compactInspirationTitle(image.title);
}

function compactInspirationTitle(title: string): string {
  const fileName = title.split('/').at(-1) ?? title;
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const stillMatch = /^(still-\d+)/i.exec(withoutExtension);
  if (stillMatch?.[1]) return stillMatch[1];
  return humanizeTitle(withoutExtension);
}

function humanizeTitle(title: string): string {
  const fileName = title.split('/').at(-1) ?? title;
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const words = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!words) return title;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
