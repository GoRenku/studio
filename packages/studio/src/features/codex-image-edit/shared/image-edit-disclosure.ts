import type { ImageEditRoute } from '@gorenku/studio-codex/image-edit';

type RouteLabels = Pick<ImageEditRoute, 'label' | 'providerLabel'>;

/** What one Generate click authorizes, shown beside Generate. */
export function imageEditGenerateDisclosure(route: RouteLabels): string {
  return `Generate uploads this image and any references it needs to ${route.providerLabel} and runs one paid ${route.label} with your saved ${route.providerLabel} key.`;
}

/** The first-person approval posted into the conversation as the user. */
export function imageEditGenerateApproval(route: RouteLabels): string {
  return `I approve uploading this image and any references it needs to ${route.providerLabel} and running one paid ${route.label} with my saved ${route.providerLabel} key.`;
}
