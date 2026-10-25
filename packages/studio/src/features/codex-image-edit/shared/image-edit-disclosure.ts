import { generationRouteBilling } from '@gorenku/studio-core/client';
import type { ImageEditRoute } from '@gorenku/studio-codex/image-edit';

type RouteLabels = Pick<ImageEditRoute, 'provider' | 'label' | 'providerLabel'>;

/** What Generate leads to, shown beside Generate as information; it is not an approval. */
export function imageEditGenerateDisclosure(route: RouteLabels): string {
  return generationRouteBilling(route.provider) === 'hostPlanUsage'
    ? `Generate edits this image with ${route.label} using your ChatGPT plan's Codex usage.`
    : `Generate uploads this image and any references it needs to ${route.providerLabel} and runs one paid ${route.label} with your saved ${route.providerLabel} key.`;
}
