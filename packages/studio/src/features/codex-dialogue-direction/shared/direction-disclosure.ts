import type { DialogueDirectionRoute } from '@gorenku/studio-codex/dialogue-direction';

type RouteLabels = Pick<DialogueDirectionRoute, 'label' | 'providerLabel'>;

/** What one Generate click authorizes, shown beside Generate. */
export function directionGenerateDisclosure(route: RouteLabels): string {
  return `Generate sends this direction and the chosen voices to ${route.providerLabel} and runs one paid ${route.label} generation with your saved ${route.providerLabel} key.`;
}

/** The first-person approval posted into the conversation as the user. */
export function directionGenerateApproval(route: RouteLabels): string {
  return `I approve sending this direction and the chosen voices to ${route.providerLabel} and running one paid ${route.label} generation with my saved ${route.providerLabel} key.`;
}

export function directionVoiceLimitNotice(route: Pick<DialogueDirectionRoute, 'label' | 'maxVoices'>): string {
  return `${route.label} takes up to ${route.maxVoices} voices. Select fewer lines.`;
}
