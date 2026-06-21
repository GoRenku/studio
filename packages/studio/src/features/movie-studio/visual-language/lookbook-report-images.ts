import type {
  LookbookImage,
  LookbookSection,
} from '@gorenku/studio-core/client';
import {
  inspirationImageUrl,
  lookbookImageFileUrl,
} from './visual-language-image-urls';

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
      folderId: string;
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
    return (point.imageFiles ?? []).map((fileName) => ({
      id: fileName,
      src: inspirationImageUrl(projectName, source.folderId, fileName),
      alt: `${fileName} inspiration grab`,
      title: fileName,
    }));
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
    return imageFiles.map((fileName) => ({
      id: fileName,
      src: inspirationImageUrl(projectName, source.folderId, fileName),
      alt: `${fileName} inspiration grab`,
      title: fileName,
    }));
  }
  return lookbookImagesToReportImages(
    projectName,
    source.imagesBySection[section] ?? []
  );
}

function lookbookImagesToReportImages(
  projectName: string,
  images: LookbookImage[]
): ReportImage[] {
  return images.flatMap((image) => {
    const file = image.asset.files[0];
    if (!file) return [];
    return [
      {
        id: image.id,
        src: lookbookImageFileUrl(projectName, image.id, file.id),
        alt: image.asset.title,
        title: image.asset.title,
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
