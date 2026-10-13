import type { DialogueDirectionRoute } from '@gorenku/studio-codex/dialogue-direction';

type RouteLabels = Pick<DialogueDirectionRoute, 'label' | 'providerLabel'>;

/** What Generate leads to, shown beside Generate as information; it is not an approval. */
export function directionGenerateDisclosure(route: RouteLabels): string {
  return `Generate sends this direction and the chosen voices to ${route.providerLabel} and runs one paid ${route.label} generation with your saved ${route.providerLabel} key.`;
}

export function directionVoiceLimitNotice(route: Pick<DialogueDirectionRoute, 'label' | 'maxVoices'>): string {
  return `${route.label} takes up to ${route.maxVoices} voices. Select fewer lines.`;
}
