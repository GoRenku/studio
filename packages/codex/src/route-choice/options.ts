import {
  HOST_GENERATION_PROVIDER,
  type DefaultModelListEntry,
  type GenerationLaneSettings,
  type ProviderCredentialStatus,
} from '@gorenku/studio-core/client';
import type { RouteChoiceProviderOption, RouteChoiceSelection } from './contracts.js';
import { routeChoiceError } from './diagnostics.js';

/**
 * Builds the provider and model options of one lane from the Skill's Default Model List.
 * Providers keep the list's order; Core supplies their labels and API key status.
 */
export function routeChoiceProviderOptions(
  entries: DefaultModelListEntry[],
  credentials: ProviderCredentialStatus[],
): RouteChoiceProviderOption[] {
  const providers = [...new Set(entries.flatMap((entry) => entry.providers))];
  return providers.map((provider) => {
    const identity = providerIdentity(provider, credentials);
    return {
      ...identity,
      models: entries
        .filter((entry) => entry.providers.includes(provider))
        .map((entry) => ({ key: entry.model, name: entry.name, recommended: entry.recommendedFor.includes(provider) })),
    };
  });
}

/** The agent's suggestion, then the lane default, then the first available provider's recommendation. */
export function preselectRoute(
  providers: RouteChoiceProviderOption[],
  lane: GenerationLaneSettings,
  suggested: RouteChoiceSelection | undefined,
): RouteChoiceSelection | null {
  if (suggested && isOffered(providers, suggested)) {
    return suggested;
  }
  const laneProvider = providers.find((option) => option.provider === lane.provider && option.available);
  if (laneProvider) {
    const saved = lane.model && laneProvider.models.find((model) => model.key === lane.model?.key);
    return { provider: laneProvider.provider, model: (saved || defaultModel(laneProvider)).key };
  }
  const first = providers.find((option) => option.available && option.models.length > 0);
  return first ? { provider: first.provider, model: defaultModel(first).key } : null;
}

export function isOffered(providers: RouteChoiceProviderOption[], selection: RouteChoiceSelection): boolean {
  const provider = providers.find((option) => option.provider === selection.provider);
  return Boolean(provider?.available && provider.models.some((model) => model.key === selection.model));
}

function defaultModel(provider: RouteChoiceProviderOption) {
  return provider.models.find((model) => model.recommended) ?? provider.models[0]!;
}

function providerIdentity(provider: string, credentials: ProviderCredentialStatus[]): Pick<RouteChoiceProviderOption, 'provider' | 'label' | 'available'> {
  if (provider === HOST_GENERATION_PROVIDER.provider) {
    return { provider, label: HOST_GENERATION_PROVIDER.label, available: true };
  }
  const credential = credentials.find((candidate) => candidate.provider === provider);
  if (!credential) {
    throw routeChoiceError(
      'CODEX_ROUTE_CHOICE_INVALID',
      `The Default Model List names provider ${provider}, which this Renku runtime does not know.`,
      'Update Renku and its skills together, then sync the Default Model List again.',
    );
  }
  return { provider, label: credential.label, available: credential.configured };
}
