import {
  HOST_GENERATION_PROVIDER,
  type CastingRoute,
  type DefaultModelListProvider,
  type DefaultModelListEntry,
  type GenerationLaneSettings,
  type ProviderCredentialStatus,
} from '@gorenku/studio-core/client';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { castingRoundError, castingRoundIssue } from './diagnostics.js';

/** The total a round opens with when nothing else sets it. */
export const CASTING_ROUND_DEFAULT_TOTAL = 10;

/** A provider of an offered model before it is priced. */
export interface CastingRoundProviderRecord {
  provider: string;
  providerLabel: string;
  recommended: boolean;
  /** The Skill's image lane route on this provider, priced at its defaults. */
  route: string;
  /** The native fields of each detail level on this route, from the Default Model List. */
  detail: NonNullable<DefaultModelListProvider['detail']>;
}

/** An offered model before it is priced. */
export interface CastingRoundOptionRecord {
  model: { key: string; name: string };
  note: string | null;
  providers: CastingRoundProviderRecord[];
}

/**
 * One option per model with at least one provider holding a saved key, in the
 * Default Model List order. Providers are ordered so the card opens on the
 * image lane's provider, then the Skill's recommendation. Core supplies
 * provider labels and key status; the Skill supplies the notes.
 */
export function castingRoundOptions(
  entries: DefaultModelListEntry[],
  credentials: ProviderCredentialStatus[],
  notes: Record<string, string>,
  laneProvider: string,
): CastingRoundOptionRecord[] {
  return entries.flatMap((entry) => {
    // Core requires detail levels on every image lane provider entry.
    const providers = entry.providers.flatMap(({ provider, route, detail }) => {
      const identity = providerIdentity(provider, credentials);
      return identity.available
        ? [{ provider, providerLabel: identity.label, recommended: entry.recommendedFor.includes(provider), route, detail: detail! }]
        : [];
    });
    const rank = (record: CastingRoundProviderRecord) => {
      if (record.provider === laneProvider) return 0;
      return record.recommended ? 1 : 2;
    };
    const ordered = providers.map((record, index) => ({ record, index }))
      .sort((a, b) => rank(a.record) - rank(b.record) || a.index - b.index)
      .map(({ record }) => record);
    return ordered.length > 0
      ? [{ model: { key: entry.model, name: entry.name }, note: notes[entry.model] ?? null, providers: ordered }]
      : [];
  });
}

/** Strength notes must name models the image lane lists. */
export function castingRoundInputIssues(
  entries: DefaultModelListEntry[],
  input: { notes?: Record<string, string> },
): DiagnosticIssue[] {
  return Object.keys(input.notes ?? {})
    .filter((modelKey) => !entries.some((entry) => entry.model === modelKey))
    .map((modelKey) => castingRoundIssue(['notes', modelKey], `${modelKey} is not a model of the Default Model List image lane.`));
}

/** The offered model and provider a route names, or undefined when the model is not offered on that provider. */
export function findCastingRoundProvider<T extends { model: { key: string }; providers: Array<{ provider: string }> }>(
  options: T[],
  route: { provider: string; model: { key: string } },
): { option: T; provider: T['providers'][number] } | undefined {
  const option = options.find((candidate) => candidate.model.key === route.model.key);
  const provider = option?.providers.find((candidate) => candidate.provider === route.provider);
  return option && provider ? { option, provider } : undefined;
}

/** The agent's suggestion, then the casting defaults, then the image lane default with the whole default total. */
export function preselectCastingRoutes(
  options: CastingRoundOptionRecord[],
  input: { suggested?: CastingRoute[]; saved: CastingRoute[]; lane: GenerationLaneSettings },
): CastingRoute[] {
  const suggested = offeredRoutes(options, input.suggested ?? []);
  if (suggested.length > 0) return suggested;
  const saved = offeredRoutes(options, input.saved);
  if (saved.length > 0) return saved;
  const onLane = options.filter((option) => option.providers[0]?.provider === input.lane.provider);
  const laneOption = (input.lane.model && onLane.find((option) => option.model.key === input.lane.model?.key))
    || onLane.find((option) => option.providers[0]?.recommended)
    || onLane[0];
  return laneOption ? [{ provider: input.lane.provider, model: laneOption.model, count: CASTING_ROUND_DEFAULT_TOTAL }] : [];
}

/** Keeps the offered routes, with the option's display name, and one route per model. */
function offeredRoutes(options: CastingRoundOptionRecord[], routes: CastingRoute[]): CastingRoute[] {
  const kept: CastingRoute[] = [];
  for (const route of routes) {
    const found = findCastingRoundProvider(options, route);
    if (found && !kept.some((entry) => entry.model.key === route.model.key)) {
      kept.push({ provider: found.provider.provider, model: found.option.model, count: route.count });
    }
  }
  return kept;
}

function providerIdentity(provider: string, credentials: ProviderCredentialStatus[]): { label: string; available: boolean } {
  if (provider === HOST_GENERATION_PROVIDER.provider) {
    return { label: HOST_GENERATION_PROVIDER.label, available: true };
  }
  const credential = credentials.find((candidate) => candidate.provider === provider);
  if (!credential) {
    throw castingRoundError(
      'CODEX_CASTING_ROUND_INVALID',
      `The Default Model List names provider ${provider}, which this Renku runtime does not know.`,
      'Update Renku and its skills together, then sync the Default Model List again.',
    );
  }
  return { label: credential.label, available: credential.configured };
}
