import type { JsonValue } from '../media/contracts.js';

/** The closed unit vocabulary a route price can use. */
export type PriceUnit = 'request' | 'image' | 'megapixel' | 'second' | 'character' | 'credit';

export const PRICE_UNITS: readonly PriceUnit[] = ['request', 'image', 'megapixel', 'second', 'character', 'credit'];

/**
 * How many units one request consumes, read from the native request.
 * `imageMegapixels` guesses the output image size from common size fields and
 * multiplies it by the optional image count field.
 */
export type PriceQuantity =
  | { kind: 'constant'; value: number }
  | { kind: 'field'; pointer: string; default?: number }
  | { kind: 'characters'; pointer: string }
  | { kind: 'imageMegapixels'; countPointer?: string };

/** A price that applies when every JSON Pointer in `when` has the given request value. */
export interface PriceTier {
  when: Record<string, JsonValue>;
  unitPriceUsd: number;
}

export interface PriceComponent {
  unit: PriceUnit;
  unitPriceUsd: number;
  quantity: PriceQuantity;
  tiers?: PriceTier[];
}

export interface RoutePriceSource {
  kind: 'providerApi' | 'recorded';
  url?: string;
  observedAt: string;
}

/**
 * The cached price for one provider route. An empty `components` list means the
 * provider publishes a price this vocabulary cannot express; `notes` say why.
 */
export interface RoutePrice {
  currency: 'USD';
  components: PriceComponent[];
  source: RoutePriceSource;
  expiresAt: string;
  notes: string[];
}

export type CostEstimateState = 'quoted' | 'computed' | 'missingPrice' | 'expired' | 'unpriced';

/** A missing price is never an amount of zero. */
export interface CostEstimate {
  state: CostEstimateState;
  amountUsd?: number;
  basis: string;
  observedAt?: string;
  sourceUrl?: string;
  notes: string[];
}

/** A provider's exact quote for one native request. */
export interface CostQuote {
  amountUsd: number;
  sourceUrl: string;
}
