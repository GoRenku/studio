import type { ShotVideoTakeReferenceImagePreview } from '@gorenku/studio-core/client';
import type { PreviewImage } from '@/ui/image-preview-dialog';

export function previewImageUrl(
  preview: ShotVideoTakeReferenceImagePreview | undefined,
  url: string | null
): PreviewImage[] {
  if (!preview || !url) {
    return [];
  }
  return [{ src: url, alt: preview.alt, title: preview.title }];
}
